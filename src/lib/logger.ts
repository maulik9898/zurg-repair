import pino from "pino";
import type { DetailedTorrent, TorrentFile } from "../types/torrent";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:standard",
    },
  },
});

export function logDetailedTorrent(torrent: DetailedTorrent) {
  logger.info(`Torrent: ${torrent.name} (Hash: ${torrent.hash})`);
  logger.info(`  Size: ${torrent.size}`);
  logger.info(`  Date Added: ${torrent.date}`);

  if (torrent.files && torrent.files.length > 0) {
    logger.info(`  Files (${torrent.files.length}):`);
    torrent.files.forEach((file: TorrentFile) => {
      logger.info(
        `    - Name: ${file.name} (Size: ${file.size}, Status: ${file.status}, ID: ${file.id})`,
      );
    });
  } else {
    logger.info(`  No files found for this torrent.`);
  }
}

export default logger;
