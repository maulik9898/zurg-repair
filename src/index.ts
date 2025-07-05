import logger, { logDetailedTorrent } from "./lib/logger";
import { config } from "./lib/config";
import { getTorrentList, getDetailedTorrentsConcurrently } from "./lib/zurg";
import { repairFilesConcurrently } from "./lib/repair";
import type { Torrent, TorrentFile } from "./types/torrent";
import ZurgScheduler from "./lib/scheduler";
import { runRepairForInstance } from "./lib/repair-runner";

// Check if we should run in scheduler mode or one-time execution mode
const SCHEDULER_MODE = process.env.SCHEDULER_MODE !== 'false'; // Default to true
const RUN_INSTANCE = process.env.RUN_INSTANCE; // Specific instance to run once

async function runOneTimeExecution() {
  try {
    if (RUN_INSTANCE) {
      // Run specific instance
      const instance = config.instances.find(i => i.name === RUN_INSTANCE);
      if (!instance) {
        logger.error(`❌ Instance '${RUN_INSTANCE}' not found in configuration`);
        process.exit(1);
      }

      if (!instance.enabled) {
        logger.error(`❌ Instance '${RUN_INSTANCE}' is disabled`);
        process.exit(1);
      }

      logger.info(`🚀 Running one-time execution for instance '${RUN_INSTANCE}'`);
      await runRepairForInstance(instance);
      logger.info(`✅ One-time execution completed for instance '${RUN_INSTANCE}'`);
    } else {
      // Run all enabled instances once
      logger.info("🚀 Running one-time execution for all enabled instances");

      const enabledInstances = config.instances.filter(i => i.enabled);
      if (enabledInstances.length === 0) {
        logger.warn("⚠️  No enabled instances found");
        return;
      }

      for (const instance of enabledInstances) {
        try {
          logger.info(`🔄 Processing instance '${instance.name}'`);
          await runRepairForInstance(instance);
          logger.info(`✅ Instance '${instance.name}' completed successfully`);
        } catch (error) {
          logger.error(`💥 Instance '${instance.name}' failed:`, error);
        }
      }

      logger.info("✅ One-time execution completed for all instances");
    }
  } catch (error) {
    logger.error("💥 Fatal error in one-time execution:", error);
    process.exit(1);
  }
}

async function runSchedulerMode() {
  try {
    logger.info("⏰ Starting in scheduler mode");

    // Log configuration summary
    logger.info("📋 Configuration Summary:");
    logger.info(`  • Total instances: ${config.instances.length}`);
    logger.info(`  • Enabled instances: ${config.instances.filter(i => i.enabled).length}`);
    logger.info(`  • Timezone: ${config.globalSettings.timezone}`);

    config.instances.forEach(instance => {
      logger.info(`  • ${instance.name}: ${instance.enabled ? '✅ enabled' : '❌ disabled'} (${instance.cronSchedule})`);
    });

    const scheduler = new ZurgScheduler();
    scheduler.startAll();

    // Keep the process alive
    logger.info("🔄 Scheduler is running. Press Ctrl+C to stop.");

    // Set up health check endpoint or status logging
    setInterval(() => {
      const status = scheduler.getStatus();
      const running = status.filter(s => s.running).length;
      if (running > 0) {
        logger.info(`💓 Health check: ${running} instance(s) currently running`);
      }
    }, 300000); // Every 5 minutes

  } catch (error) {
    logger.error("💥 Fatal error in scheduler mode:", error);
    process.exit(1);
  }
}

async function main() {
  const startTime = Date.now();

  // Handle graceful shutdown
  const setupShutdownHandlers = () => {
    const shutdown = (signal: string) => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🛑 Received ${signal}, shutting down after ${duration}s...`);
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  };

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.fatal("💥 Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal("💥 Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  });

  try {
    logger.info("🚀 Starting Zurg File Repair System");
    logger.info(`📋 Mode: ${SCHEDULER_MODE ? 'Scheduler' : 'One-time execution'}`);

    if (SCHEDULER_MODE) {
      setupShutdownHandlers();
      await runSchedulerMode();
    } else {
      await runOneTimeExecution();
      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(`🎉 Application completed in ${duration}s`);
    }
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.error(`💥 Fatal error after ${duration}s:`, error);
    process.exit(1);
  }
}

main();
