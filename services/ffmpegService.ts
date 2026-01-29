
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class FFmpegService {
  private static ffmpeg: FFmpeg | null = null;

  static async load() {
    if (this.ffmpeg) return this.ffmpeg;

    try {
      const ffmpeg = new FFmpeg();
      const coreVersion = '0.12.6';
      const ffmpegVersion = '0.12.10';
      const coreBaseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;
      const ffmpegBaseURL = `https://unpkg.com/@ffmpeg/ffmpeg@${ffmpegVersion}/dist/esm`;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, 'text/javascript'),
      });

      this.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('FFmpeg 引擎加载失败。');
    }
  }

  /**
   * 生成一个符合 Apple 规范的 UUID 字符串
   * 包含对非安全上下文 (HTTP) 的兼容性处理
   */
  private static generateAssetId(): string {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().toUpperCase();
      }
    } catch (e) {
      console.warn('crypto.randomUUID not available, using fallback');
    }

    // RFC4122 v4 兼容的备用生成器
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }).toUpperCase();
  }

  static async synthesize(
    imageFile: File, 
    audioFile: File, 
    duration: number, 
    audioOffset: number,
    onLog?: (msg: string) => void
  ): Promise<{ videoUrl: string, imageUrl: string }> {
    const ffmpeg = await this.load();
    const assetId = this.generateAssetId();
    
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }

    // 清理旧文件
    const files = ['input_img', 'input_audio', 'output.mov', 'tagged_img.jpg'];
    for (const f of files) {
      try { await ffmpeg.deleteFile(f); } catch (e) {}
    }

    await ffmpeg.writeFile('input_img', await fetchFile(imageFile));
    await ffmpeg.writeFile('input_audio', await fetchFile(audioFile));

    const delayMs = Math.round(audioOffset * 1000);

    // 1. 处理图片：注入元数据标识符
    await ffmpeg.exec([
      '-i', 'input_img',
      '-metadata', `comment=${assetId}`,
      '-metadata', `title=${assetId}`,
      'tagged_img.jpg'
    ]);

    // 2. 合成视频并注入关键的 Apple 内容标识符
    await ffmpeg.exec([
      '-framerate', '30',
      '-loop', '1',
      '-i', 'input_img',
      '-i', 'input_audio',
      '-filter_complex', 
      `[0:v]scale='trunc(iw/2)*2:trunc(ih/2)*2',format=yuv420p[v];` +
      `[1:a]adelay=${delayMs}|${delayMs},aresample=async=1[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-t', duration.toString(),
      '-metadata', `com.apple.quicktime.content.identifier=${assetId}`,
      '-y',
      'output.mov'
    ]);

    const videoData = await ffmpeg.readFile('output.mov');
    const imageData = await ffmpeg.readFile('tagged_img.jpg');

    return {
      videoUrl: URL.createObjectURL(new Blob([videoData], { type: 'video/quicktime' })),
      imageUrl: URL.createObjectURL(new Blob([imageData], { type: 'image/jpeg' }))
    };
  }
}
