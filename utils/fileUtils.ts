
import JSZip from 'jszip';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const createLivePhotoPackage = async (imageFile: File, videoUrl: string, fileName: string = 'LivePhoto') => {
  const zip = new JSZip();
  
  // Fetch video blob
  const videoResponse = await fetch(videoUrl);
  const videoBlob = await videoResponse.blob();

  // A real iOS Live Photo requires a matching Asset Identifier in metadata.
  // In a pure web environment without specialized metadata tools, we provide the paired files.
  // We name them specifically as expected by some importers.
  zip.file(`${fileName}.JPG`, imageFile);
  zip.file(`${fileName}.MOV`, videoBlob);

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
};

export const createFullPackage = async (imageFile: File, audioFile: File, videoUrl: string) => {
  const zip = new JSZip();
  
  const videoResponse = await fetch(videoUrl);
  const videoBlob = await videoResponse.blob();

  zip.file('original_image.jpg', imageFile);
  zip.file('original_audio.mp3', audioFile);
  zip.file('generated_video.mov', videoBlob);

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
};
