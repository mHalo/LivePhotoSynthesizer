
// Fix: Added DOM library reference to resolve 'HTMLInputElement', 'document' and other DOM types.
/// <reference lib="dom" />
import React, { useState, useRef } from 'react';
import { FileImage, Music, Download, RefreshCcw, CheckCircle, AlertCircle, Settings, Clock, PlayCircle } from 'lucide-react';
import { Button } from './components/Button';
import { FFmpegService } from './services/ffmpegService';
import { createLivePhotoPackage, createFullPackage } from './utils/fileUtils';
import { ProcessingResult, UploadedFiles } from './types';

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFiles>({ image: null, audio: null });
  const [config, setConfig] = useState({ duration: 3.0, offset: 0.0 });
  const [result, setResult] = useState<ProcessingResult>({
    imageUrl: '',
    videoUrl: '',
    status: 'idle'
  });
  
  // 存储处理后的图片 Blob URL（带有元数据）
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: 'image' | 'audio') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      if (type === 'image') {
        const url = URL.createObjectURL(file);
        setResult(prev => ({ ...prev, imageUrl: url }));
      }
    }
  };

  const processSynthesis = async () => {
    if (!files.image || !files.audio) return;

    setResult(prev => ({ 
      ...prev, 
      status: 'processing', 
      progressMessage: '正在启动 FFmpeg 引擎...' 
    }));

    try {
      // 这里的合成现在返回匹配了元数据的图片和视频
      const { videoUrl, imageUrl } = await FFmpegService.synthesize(
        files.image, 
        files.audio, 
        config.duration, 
        config.offset,
        (msg) => setResult(prev => ({ ...prev, progressMessage: `处理中: ${msg.slice(0, 50)}...` }))
      );

      setProcessedImageUrl(imageUrl);
      setResult(prev => ({
        ...prev,
        videoUrl,
        imageUrl, // 更新预览图为处理后的图片
        status: 'completed',
        progressMessage: '合成成功！'
      }));
    } catch (error: any) {
      console.error(error);
      setResult(prev => ({
        ...prev,
        status: 'error',
        error: error.message || '合成过程中发生意外错误。'
      }));
    }
  };

  const downloadLivePhoto = async () => {
    if (!processedImageUrl || !result.videoUrl) return;
    
    // 从 URL 还原 File 对象以供压缩
    const imageResponse = await fetch(processedImageUrl);
    const imageBlob = await imageResponse.blob();
    const taggedImageFile = new File([imageBlob], "IMG_LIVE.JPG", { type: "image/jpeg" });

    const blob = await createLivePhotoPackage(taggedImageFile, result.videoUrl, 'IMG_LIVE');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LivePhoto_Pack.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFullPack = async () => {
    if (!files.image || !files.audio || !result.videoUrl) return;
    const blob = await createFullPackage(files.image, files.audio, result.videoUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Project_Archive.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFiles({ image: null, audio: null });
    setProcessedImageUrl(null);
    setResult({ imageUrl: '', videoUrl: '', status: 'idle' });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 min-h-screen flex flex-col font-sans">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 flex items-center justify-center gap-3">
          <PlayCircle className="text-indigo-600 w-10 h-10" />
          实况照片合成器
        </h1>
        <p className="text-slate-600 text-lg">
          自动注入 Apple Content Identifier，生成 iOS 原生支持的实况照片。
        </p>
      </header>

      <main className="flex-1 space-y-8">
        {result.status === 'idle' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 文件上传区 */}
            <div className="grid md:grid-cols-2 gap-6">
              <div 
                onClick={() => imageInputRef.current?.click()}
                className={`group p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${files.image ? 'border-indigo-500 bg-indigo-50 shadow-inner' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
              >
                <input type="file" ref={imageInputRef} onChange={handleFileChange('image')} accept="image/*" className="hidden" />
                <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${files.image ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                  <FileImage size={32} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">
                    {files.image ? files.image.name : '点击选择图片'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">JPG, PNG, HEIC</p>
                </div>
              </div>

              <div 
                onClick={() => audioInputRef.current?.click()}
                className={`group p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${files.audio ? 'border-pink-500 bg-pink-50 shadow-inner' : 'border-slate-300 hover:border-pink-400 hover:bg-slate-50'}`}
              >
                <input type="file" ref={audioInputRef} onChange={handleFileChange('audio')} accept="audio/*" className="hidden" />
                <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${files.audio ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                  <Music size={32} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">
                    {files.audio ? files.audio.name : '点击选择音频'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">MP3, WAV, M4A</p>
                </div>
              </div>
            </div>

            {/* 配置区 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6 text-slate-800 border-b pb-4">
                <Settings className="w-5 h-5" />
                <h3 className="font-bold">合成参数配置</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Clock size={16} className="text-indigo-500" />
                    视频总时长 (秒)
                  </label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="1" 
                    value={config.duration}
                    onChange={(e) => setConfig(prev => ({ ...prev, duration: parseFloat(e.target.value) || 3 }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <p className="text-xs text-slate-400">iOS 标准实况视频通常为 1.5 - 3.0 秒</p>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Music size={16} className="text-pink-500" />
                    音频延迟启动 (秒)
                  </label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={config.offset}
                    onChange={(e) => setConfig(prev => ({ ...prev, offset: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={processSynthesis}
                disabled={!files.image || !files.audio}
                className="w-full md:w-80 h-14 text-lg shadow-xl shadow-indigo-200"
              >
                生成带元数据的实况照片
              </Button>
            </div>
          </div>
        )}

        {/* 处理中状态 */}
        {result.status === 'processing' && (
          <div className="bg-white p-16 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center gap-8 text-center">
            <div className="relative">
               <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
               <Settings className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-8 h-8 animate-pulse" />
            </div>
            <div className="max-w-md">
              <h2 className="text-2xl font-bold text-slate-800">正在同步元数据并合成...</h2>
              <p className="text-slate-500 mt-3 text-sm font-mono overflow-hidden h-6">
                {result.progressMessage}
              </p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {result.status === 'error' && (
          <div className="bg-red-50 p-8 rounded-3xl border border-red-200 flex flex-col items-center gap-4 text-center">
            <AlertCircle size={48} className="text-red-500" />
            <h2 className="text-xl font-bold text-red-800">合成失败</h2>
            <p className="text-red-600">{result.error}</p>
            <Button variant="outline" onClick={reset} className="mt-4">
              重置并重试
            </Button>
          </div>
        )}

        {/* 完成状态 */}
        {result.status === 'completed' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center group relative">
                <video 
                  src={result.videoUrl} 
                  autoPlay 
                  loop 
                  muted 
                  controls
                  className="w-full h-full max-h-[500px] object-contain"
                />
                <div className="absolute top-4 right-4 bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                  元数据已注入
                </div>
              </div>

              <div className="flex flex-col justify-center gap-6">
                <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                  <h3 className="text-lg font-bold text-green-900 flex items-center gap-2 mb-2">
                    <CheckCircle size={20} />
                    合成完毕
                  </h3>
                  <p className="text-green-700 text-sm">
                    图片和视频已包含匹配的 Asset Identifier。下载后的 ZIP 包解压后导入 iOS 设备（如通过隔空投送）即可识别为实况照片。
                  </p>
                </div>

                <div className="space-y-4">
                  <Button onClick={downloadLivePhoto} className="w-full text-lg py-7 rounded-2xl">
                    <Download size={24} />
                    下载实况照片 (ZIP)
                  </Button>
                  
                  <Button variant="outline" onClick={reset} className="w-full py-4 text-slate-400 border-none hover:text-indigo-600">
                    <RefreshCcw size={18} />
                    制作下一个
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 text-center text-slate-400 text-xs pb-12">
        <p>© 2024 Live Photo Studio • 符合 Apple 实况照片元数据规范</p>
      </footer>
    </div>
  );
};

export default App;
