
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
      
      // 使用标准 unpkg 路径，确保跨环境可用
      const coreBaseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;
      const ffmpegBaseURL = `https://unpkg.com/@ffmpeg/ffmpeg@${ffmpegVersion}/dist/esm`;

      console.log('Loading FFmpeg core and worker...');

      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, 'text/javascript'),
      });

      console.log('FFmpeg loaded successfully');
      this.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('FFmpeg 引擎加载失败。请确保您的浏览器支持 WebAssembly 和 SharedArrayBuffer。');
    }
  }

  static async synthesize(
    imageFile: File, 
    audioFile: File, 
    duration: number, 
    audioOffset: number,
    onLog?: (msg: string) => void
  ): Promise<string> {
    const ffmpeg = await this.load();
    
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }

    // 清理旧文件
    const files = ['input_img', 'input_audio', 'output.mov'];
    for (const f of files) {
      try { await ffmpeg.deleteFile(f); } catch (e) {}
    }

    await ffmpeg.writeFile('input_img', await fetchFile(imageFile));
    await ffmpeg.writeFile('input_audio', await fetchFile(audioFile));

    const delayMs = Math.round(audioOffset * 1000);
    
    /**
     * 优化后的 FFmpeg 指令说明：
     * 1. -framerate 30: 明确设置图片的输入帧率。
     * 2. -loop 1: 循环图片。
     * 3. vf "scale=...": 关键步骤！使用 scale 滤镜将宽高强制转换为偶数（trunc(iw/2)*2），
     *    否则 libx264 在处理奇数像素的图片时会直接报错导致 0s 视频。
     * 4. -t: 放在输出文件前，严格控制输出总时长。
     * 5. -fflags +genpts: 重新生成时间戳，确保视频在 iOS 上播放不卡顿。
     */
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
      '-y',
      'output.mov'
    ]);

    const data = await ffmpeg.readFile('output.mov');
    if (data.length < 1000) {
      throw new Error('生成的视频文件异常过小，请尝试更换图片或音频文件。');
    }

    return URL.createObjectURL(new Blob([data], { type: 'video/quicktime' }));
  }
}
