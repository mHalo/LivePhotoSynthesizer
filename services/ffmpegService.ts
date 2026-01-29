
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
      
      // Using unpkg consistently for all parts to avoid cross-origin confusion
      const coreBaseURL = `http://192.168.1.252:5789/unpkg/@ffmpeg/core@${coreVersion}/dist/esm`;
      const ffmpegBaseURL = `http://192.168.1.252:5789/unpkg/@ffmpeg/ffmpeg@${ffmpegVersion}/dist/esm`;

      console.log('Loading FFmpeg core and worker...');

      // In some environments, toBlobURL from @ffmpeg/util might be restricted or fail.
      // We use the direct paths on unpkg which are known to have correct CORS headers.
      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        // This is the critical part: providing a blob URL for the worker.
        // This forces the browser to treat the worker script as same-origin.
        workerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, 'text/javascript'),
      });

      console.log('FFmpeg loaded successfully');
      this.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('FFmpeg 引擎加载失败。这通常是由于浏览器安全策略（CORS/COOP/COEP）或网络连接问题导致的。请确认您正在使用支持 SharedArrayBuffer 的现代浏览器（如 Chrome, Edge 或 Firefox）。');
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

    // Clean up previous files if they exist to prevent memory issues or overlaps
    try {
      await ffmpeg.deleteFile('input_img');
      await ffmpeg.deleteFile('input_audio');
      await ffmpeg.deleteFile('output.mov');
    } catch (e) {
      // Ignore errors if files don't exist
    }

    await ffmpeg.writeFile('input_img', await fetchFile(imageFile));
    await ffmpeg.writeFile('input_audio', await fetchFile(audioFile));

    const delayMs = Math.round(audioOffset * 1000);
    
    // FFmpeg commands:
    // -loop 1: Loop the image to create a video stream.
    // -t: Set the total duration of the output.
    // -i input_img: The source image.
    // -i input_audio: The source audio.
    // -filter_complex adelay: Delays the audio start by specified milliseconds.
    // -c:v libx264: Uses standard H.264 video encoding.
    // -pix_fmt yuv420p: Best compatibility for Apple/iOS (QuickTime).
    // -shortest: Ensure it finishes based on the defined duration.
    await ffmpeg.exec([
      '-loop', '1',
      '-t', duration.toString(),
      '-i', 'input_img',
      '-i', 'input_audio',
      '-filter_complex', `[1:a]adelay=${delayMs}|${delayMs}[delayed_a]`,
      '-map', '0:v',
      '-map', '[delayed_a]',
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      'output.mov'
    ]);

    const data = await ffmpeg.readFile('output.mov');
    return URL.createObjectURL(new Blob([data], { type: 'video/quicktime' }));
  }
}
