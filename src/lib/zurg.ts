import config from "./config";
import logger, { logDetailedTorrent } from "./logger";
import { parseTorrentList } from "./parser";
import { parseTorrentFiles } from "./torrentDetailsParser";
import type { Torrent, DetailedTorrent } from "../types/torrent";

async function getManagePageHtml(baseUrl: string): Promise<string> {
  const url = new URL("/manage/", baseUrl);

  const response = await fetch(url);

  if (!response.ok) {
    logger.error(
      { status: response.status, statusText: response.statusText, baseUrl },
      "Failed to fetch manage page",
    );
    throw new Error(`Failed to fetch manage page from ${baseUrl}: ${response.statusText}`);
  }

  return response.text();
}

export async function getTorrentList(baseUrl: string = config.ZURG_BASE_URL): Promise<Torrent[]> {
  const html = await getManagePageHtml(baseUrl);
  return parseTorrentList(html);
}

export async function getTorrentDetailsPageHtml(hash: string, baseUrl: string = config.ZURG_BASE_URL): Promise<string> {
  const url = new URL(`/manage/${hash}/`, baseUrl);

  const response = await fetch(url);

  if (!response.ok) {
    logger.error(
      { status: response.status, statusText: response.statusText, hash, baseUrl },
      `Failed to fetch torrent details page for hash: ${hash}`,
    );
    throw new Error(
      `Failed to fetch torrent details page for hash ${hash} from ${baseUrl}: ${response.statusText}`,
    );
  }

  return response.text();
}

export async function getDetailedTorrent(
  torrent: Torrent,
  baseUrl: string = config.ZURG_BASE_URL,
): Promise<DetailedTorrent> {
  const detailHtml = await getTorrentDetailsPageHtml(torrent.hash, baseUrl);
  const files = parseTorrentFiles(detailHtml);

  return { ...torrent, files };
}

// Helper function to process a batch of torrents
async function processBatch(torrents: Torrent[], baseUrl: string): Promise<DetailedTorrent[]> {
  const results = await Promise.allSettled(
    torrents.map((torrent) => getDetailedTorrent(torrent, baseUrl)),
  );

  const detailedTorrents: DetailedTorrent[] = [];

  results.forEach((result, index) => {
    const torrent = torrents[index];

    if (!torrent) {
      logger.warn(`Torrent at index ${index} is undefined`);
      return;
    }

    if (result.status === "fulfilled") {
      const detailedTorrent = result.value;
      // Skip torrents where all files are available
      const allFilesAvailable = detailedTorrent.files.every(
        (file) => file.status.toLowerCase() === "available",
      );

      if (!allFilesAvailable) {
        detailedTorrents.push(detailedTorrent);
      }
    } else {
      logger.warn(
        `Could not fetch details for torrent ${torrent.name} (Hash: ${torrent.hash}): ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
      // If details can't be fetched, assume it's broken
      detailedTorrents.push({
        name: torrent.name,
        hash: torrent.hash,
        size: torrent.size,
        date: torrent.date,
        files: [],
      });
    }
  });

  return detailedTorrents;
}

// Helper function to split array into chunks
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function getDetailedTorrentsConcurrently(
  torrents: Torrent[],
  baseUrl: string = config.ZURG_BASE_URL,
  concurrencyLimit: number = config.CONCURRENCY_LIMIT,
): Promise<DetailedTorrent[]> {
  const chunks = chunkArray(torrents, concurrencyLimit);
  const allDetailedTorrents: DetailedTorrent[] = [];

  logger.info(
    `Processing ${torrents.length} torrents in ${chunks.length} batches of max ${concurrencyLimit}`,
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (!chunk) {
      logger.warn(`Chunk at index ${i} is undefined`);
      continue;
    }

    logger.info(
      `Processing batch ${i + 1}/${chunks.length} (${chunk.length} torrents)`,
    );

    try {
      const batchResults = await processBatch(chunk, baseUrl);
      allDetailedTorrents.push(...batchResults);
    } catch (error) {
      logger.error(
        `Error processing batch ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return allDetailedTorrents;
}

export async function deleteFile(
  torrentHash: string,
  fileId: string,
  baseUrl: string = config.ZURG_BASE_URL,
): Promise<void> {
  const url = new URL(
    `/manage/${torrentHash}/files/${fileId}/delete`,
    baseUrl,
  );

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    logger.error(
      {
        status: response.status,
        statusText: response.statusText,
        torrentHash,
        fileId,
        baseUrl,
      },
      "Failed to delete file",
    );
    throw new Error(
      `Failed to delete file ${fileId} for torrent ${torrentHash} from ${baseUrl}: ${response.statusText}`,
    );
  }
}

export async function restoreFile(
  torrentHash: string,
  fileId: string,
  baseUrl: string = config.ZURG_BASE_URL,
): Promise<void> {
  const url = new URL(
    `/manage/${torrentHash}/files/${fileId}/restore`,
    baseUrl,
  );

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    logger.error(
      {
        status: response.status,
        statusText: response.statusText,
        torrentHash,
        fileId,
        baseUrl,
      },
      "Failed to restore file",
    );
    throw new Error(
      `Failed to restore file ${fileId} for torrent ${torrentHash} from ${baseUrl}: ${response.statusText}`,
    );
  }
}
