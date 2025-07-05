export interface TorrentFile {
  name: string;
  size: string;
  status: string; // e.g., 'Available', 'Broken', 'Deleted'
  id: string; // Extracted from the form action URL
}

export interface Torrent {
  name: string;
  hash: string;
  size: string;
  date: string;
}

export interface DetailedTorrent extends Torrent {
  files: TorrentFile[];
}
