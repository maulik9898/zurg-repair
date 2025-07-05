import logger from "./logger";
import { deleteFile, restoreFile, getDetailedTorrent } from "./zurg";
import type { Torrent, TorrentFile } from "../types/torrent";

export interface RepairResult {
  torrentHash: string;
  fileId: string;
  fileName: string;
  status: "repaired" | "failed" | "error";
  message: string;
}

/**
 * Attempts to repair a broken file by deleting and restoring it
 * @param torrent The torrent containing the file
 * @param file The file to repair
 * @param baseUrl The base URL of the Zurg instance
 * @param maxRetries Maximum number of verification attempts after restore
 * @param retryDelay Delay between verification attempts in milliseconds
 * @returns RepairResult indicating success/failure
 */
export async function repairFile(
  torrent: Torrent,
  file: TorrentFile,
  baseUrl: string,
  maxRetries: number = 3,
  retryDelay: number = 2000,
): Promise<RepairResult> {
  const { hash: torrentHash } = torrent;
  const { id: fileId, name: fileName } = file;

  logger.info(`Starting repair for file: ${fileName}`);

  try {
    // Step 1: Delete the file
    await deleteFile(torrentHash, fileId, baseUrl);

    // Step 2: Restore the file
    await restoreFile(torrentHash, fileId, baseUrl);

    // Step 3: Wait a bit for the restore to process
    await new Promise((resolve) => setTimeout(resolve, retryDelay));

    // Step 4: Verify the file is repaired with retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const updatedTorrent = await getDetailedTorrent(torrent, baseUrl);
        const updatedFile = updatedTorrent.files.find((f) => f.id === fileId);

        if (!updatedFile) {
          logger.warn(
            { torrentHash, fileId, fileName, attempt },
            "File not found after restore attempt",
          );
          continue;
        }

        const isAvailable = updatedFile.status.toLowerCase() === "available";

        if (isAvailable) {
          logger.info(`✅ File '${fileName}' repaired successfully`);
          return {
            torrentHash,
            fileId,
            fileName,
            status: "repaired",
            message: `File repaired successfully after ${attempt} verification attempt(s)`,
          };
        } else {
          // Only log retries/failures
          if (attempt === maxRetries) {
            logger.warn(
              `File '${fileName}' still not available after ${attempt} attempts (Status: ${updatedFile.status})`,
            );
          }
        }
      } catch (verifyError) {
        // Only log verification errors on final attempt or if critical
        if (attempt === maxRetries) {
          logger.warn(
            `Verification error for '${fileName}' on final attempt: ${verifyError instanceof Error
              ? verifyError.message
              : String(verifyError)
            }`,
          );
        }
      }

      // Wait before next verification attempt (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    // If we reach here, all verification attempts failed
    logger.error(
      `❌ File '${fileName}' repair failed - still not available after ${maxRetries} attempts`,
    );
    return {
      torrentHash,
      fileId,
      fileName,
      status: "failed",
      message: `File repair failed - still not available after ${maxRetries} verification attempts`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`💥 Error repairing '${fileName}': ${errorMessage}`);
    return {
      torrentHash,
      fileId,
      fileName,
      status: "error",
      message: `Repair process failed: ${errorMessage}`,
    };
  }
}

/**
 * Repairs multiple files concurrently with a concurrency limit
 * @param repairs Array of {torrent, file} pairs to repair
 * @param baseUrl The base URL of the Zurg instance
 * @param concurrencyLimit Maximum number of concurrent repairs
 * @param maxRetries Maximum retries per file verification
 * @param retryDelay Delay between verification attempts
 * @returns Array of RepairResult
 */
export async function repairFilesConcurrently(
  repairs: Array<{ torrent: Torrent; file: TorrentFile }>,
  baseUrl: string,
  concurrencyLimit: number = 5,
  maxRetries: number = 3,
  retryDelay: number = 2000,
): Promise<RepairResult[]> {
  logger.info(
    { totalRepairs: repairs.length, concurrencyLimit },
    "Starting concurrent repair process",
  );

  const results: RepairResult[] = [];

  // Split repairs into chunks for concurrency control
  for (let i = 0; i < repairs.length; i += concurrencyLimit) {
    const chunk = repairs.slice(i, i + concurrencyLimit);

    logger.info(
      {
        currentBatch: Math.floor(i / concurrencyLimit) + 1,
        totalBatches: Math.ceil(repairs.length / concurrencyLimit),
        batchSize: chunk.length,
      },
      "Processing repair batch",
    );

    const chunkPromises = chunk.map(({ torrent, file }) =>
      repairFile(torrent, file, baseUrl, maxRetries, retryDelay),
    );

    const chunkResults = await Promise.allSettled(chunkPromises);

    chunkResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const repair = chunk[index];
        if (repair) {
          logger.error(
            {
              torrentHash: repair.torrent.hash,
              fileId: repair.file.id,
              fileName: repair.file.name,
              error: result.reason,
            },
            "Repair promise rejected",
          );
          results.push({
            torrentHash: repair.torrent.hash,
            fileId: repair.file.id,
            fileName: repair.file.name,
            status: "error",
            message: `Repair promise rejected: ${String(result.reason)}`,
          });
        }
      }
    });
  }

  // Log summary
  const summary = results.reduce(
    (acc, result) => {
      acc[result.status]++;
      return acc;
    },
    { repaired: 0, failed: 0, error: 0 },
  );

  logger.info(
    {
      total: results.length,
      repaired: summary.repaired,
      failed: summary.failed,
      errors: summary.error,
    },
    "Repair process completed",
  );

  return results;
}
