export interface AudioSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  filename?: string;
  confidence?: number;
  isPlaying?: boolean;
}

export interface AudioMetadata {
  name: string;
  size: string;
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: string;
}

export interface ActivityLog {
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface PythonProjectFiles {
  [filename: string]: string;
}
