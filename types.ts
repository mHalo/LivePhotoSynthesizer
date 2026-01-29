
export interface ProcessingResult {
  imageUrl: string;
  videoUrl: string;
  audioUrl?: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
  progressMessage?: string;
}

export interface UploadedFiles {
  image: File | null;
  audio: File | null;
}
