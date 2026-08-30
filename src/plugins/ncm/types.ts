export interface Track {
  id: number;
  v: number;
  name: string;
  artists: string[];
  album: string;
  duration: number; // ms
  picUrl?: string;
}

export interface PlaylistInfo {
  id: number;
  name: string;
  creator: string;
  trackCount: number;
  playCount: number;
  coverUrl: string;
}

export type QRStatus = 800 | 801 | 802 | 803; // 过期/待扫码/待确认/成功

export interface DownloadTask {
  track: Track;
  status: 'pending' | 'downloading' | 'done' | 'error' | 'skipped';
  progress: number;
  url?: string;
  error?: string;
  filePath?: string;
}
