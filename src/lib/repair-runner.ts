import logger from "./logger";
import { getTorrentList, getDetailedTorrentsConcurrently } from "./zurg";
import { repairFilesConcurrently } from "./repair";
import type { Torrent, TorrentFile } from "../types/torrent";
import type { ZurgInstance } from "./config";

/**
 * Run the repair process for a specific Zurg instance
 */
export async function runRepairForInstance(instance: ZurgInstance): Promise<void> {
    const startTime = Date.now();

    try {
        logger.info(`🚀 Starting repair process for instance '${instance.name}'`);

        // Step 1: Get all torrents
        logger.info("📥 Fetching all torrents...");
        const allTorrents = await getTorrentList(instance.baseUrl);
        logger.info(`📊 Found ${allTorrents.length} total torrents`);

        if (allTorrents.length === 0) {
            logger.info("ℹ️  No torrents found, nothing to process");
            return;
        }

        // Step 2: Get detailed info for all torrents to find broken files
        logger.info("🔍 Analyzing torrents for broken files...");
        const detailedTorrents = await getDetailedTorrentsConcurrently(
            allTorrents,
            instance.baseUrl,
            instance.concurrencyLimit
        );

        // Step 3: Collect all broken files
        const brokenFiles: Array<{ torrent: Torrent; file: TorrentFile }> = [];
        let torrentsWithBrokenFiles = 0;

        for (const torrent of detailedTorrents) {
            const brokenFilesInTorrent = torrent.files.filter(
                (file) => file.status.toLowerCase() !== "available",
            );

            if (brokenFilesInTorrent.length > 0) {
                torrentsWithBrokenFiles++;
                for (const file of brokenFilesInTorrent) {
                    brokenFiles.push({ torrent, file });
                }
            }
        }

        // Step 4: Report findings
        logger.info(`📈 Analysis complete for '${instance.name}':`);
        logger.info(`  • Total torrents: ${allTorrents.length}`);
        logger.info(`  • Torrents with broken files: ${torrentsWithBrokenFiles}`);
        logger.info(`  • Total broken files found: ${brokenFiles.length}`);

        if (brokenFiles.length === 0) {
            logger.info(`🎉 No broken files found for '${instance.name}'! All files are available.`);
            return;
        }

        // Step 5: Repair all broken files
        logger.info(
            `🔧 Starting repair process for ${brokenFiles.length} broken files...`,
        );

        const repairResults = await repairFilesConcurrently(
            brokenFiles,
            instance.baseUrl,
            instance.concurrencyLimit,
            instance.retryAttempts,
            instance.retryDelay,
        );

        // Step 6: Generate final report
        const summary = repairResults.reduce(
            (acc, result) => {
                acc[result.status]++;
                return acc;
            },
            { repaired: 0, failed: 0, error: 0 },
        );

        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);

        logger.info(`📋 === REPAIR REPORT FOR '${instance.name.toUpperCase()}' ===`);
        logger.info(`⏱️  Total time: ${duration} seconds`);
        logger.info(`📊 Results:`);
        logger.info(`  • ✅ Successfully repaired: ${summary.repaired}`);
        logger.info(`  • ❌ Failed to repair: ${summary.failed}`);
        logger.info(`  • 💥 Errors encountered: ${summary.error}`);

        if (brokenFiles.length > 0) {
            logger.info(
                `  • 📈 Success rate: ${Math.round((summary.repaired / brokenFiles.length) * 100)}%`,
            );
        }

        // Step 7: Log detailed failures if any
        if (summary.failed > 0 || summary.error > 0) {
            logger.warn(`⚠️  Failed/Error repairs for '${instance.name}':`);
            repairResults
                .filter((r) => r.status !== "repaired")
                .forEach((result) => {
                    logger.warn(`  • ${result.fileName}: ${result.message}`);
                });
        }

        // Step 8: Throw error if repairs failed (for scheduler to catch)
        if (summary.failed > 0 || summary.error > 0) {
            const message = `Some repairs failed for instance '${instance.name}'. ${summary.failed} failed, ${summary.error} errors.`;
            logger.warn(`⚠️  ${message}`);
            throw new Error(message);
        } else {
            logger.info(`🎉 All repairs completed successfully for '${instance.name}'!`);
        }
    } catch (error) {
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);

        logger.error(`💥 Fatal error in instance '${instance.name}' after ${duration} seconds:`);
        if (error instanceof Error) {
            logger.error(`   ${error.message}`);
            if (error.stack) {
                logger.debug(`   Stack: ${error.stack}`);
            }
        } else {
            logger.error(`   ${String(error)}`);
        }
        throw error; // Re-throw for scheduler to handle
    }
} 