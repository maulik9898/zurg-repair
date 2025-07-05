import cron, { type ScheduledTask } from "node-cron";
import logger from "./logger";
import { config, type ZurgInstance } from "./config";
import { runRepairForInstance } from "./repair-runner";

class ZurgScheduler {
	private jobs: Map<string, ScheduledTask> = new Map();
	private runningJobs: Set<string> = new Set();

	constructor() {
		this.setupSignalHandlers();
	}

	/**
	 * Start all enabled instances based on their cron schedules
	 */
	public startAll(): void {
		logger.info("🚀 Starting Zurg Repair Scheduler");
		logger.info(`📋 Loaded ${config.instances.length} instance(s)`);

		for (const instance of config.instances) {
			if (instance.enabled) {
				this.scheduleInstance(instance);
			} else {
				logger.info(`⏸️  Instance '${instance.name}' is disabled, skipping`);
			}
		}

		logger.info("⏰ All schedulers started successfully");
		this.logNextRunTimes();
	}

	/**
	 * Schedule a single instance
	 */
	private scheduleInstance(instance: ZurgInstance): void {
		logger.info(
			`📅 Scheduling instance '${instance.name}' with cron: ${instance.cronSchedule}`,
		);
		logger.debug(`🌍 Using timezone: ${config.globalSettings.timezone}`);

		if (!cron.validate(instance.cronSchedule)) {
			logger.error(
				`❌ Invalid cron expression for instance '${instance.name}': ${instance.cronSchedule}`,
			);
			return;
		}

		try {
			const task = cron.schedule(
				instance.cronSchedule,
				() => this.executeInstance(instance),
				{
					timezone: config.globalSettings.timezone,
				},
			);

			this.jobs.set(instance.name, task);
			task.start();

			logger.info(`✅ Instance '${instance.name}' scheduled successfully`);

			logger.debug(
				`🕐 Instance '${instance.name}' scheduled with: ${instance.cronSchedule}`,
			);
		} catch (error) {
			logger.error(`❌ Failed to schedule instance '${instance.name}':`, error);
		}
	}

	/**
	 * Execute repair process for a specific instance
	 */
	private async executeInstance(instance: ZurgInstance): Promise<void> {
		const jobKey = instance.name;

		if (this.runningJobs.has(jobKey)) {
			logger.warn(
				`⚠️  Instance '${jobKey}' is already running, skipping this execution`,
			);
			return;
		}

		this.runningJobs.add(jobKey);
		const startTime = Date.now();

		try {
			logger.info(`🔄 Starting repair process for instance '${instance.name}'`);
			logger.info(`🌐 Base URL: ${instance.baseUrl}`);
			logger.info(`⚡ Concurrency: ${instance.concurrencyLimit}`);

			await runRepairForInstance(instance);

			const duration = Math.round((Date.now() - startTime) / 1000);
			logger.info(
				`✅ Instance '${instance.name}' completed successfully in ${duration}s`,
			);
		} catch (error) {
			const duration = Math.round((Date.now() - startTime) / 1000);
			logger.error(
				`💥 Instance '${instance.name}' failed after ${duration}s:`,
				error,
			);
		} finally {
			this.runningJobs.delete(jobKey);
		}
	}

	/**
	 * Stop all scheduled jobs
	 */
	public stopAll(): void {
		logger.info("🛑 Stopping all scheduled jobs...");

		for (const [name, task] of this.jobs) {
			task.destroy();
			logger.info(`⏹️  Stopped job for instance '${name}'`);
		}

		this.jobs.clear();
		logger.info("✅ All jobs stopped");
	}

	/**
	 * Get status of all instances
	 */
	public getStatus(): Array<{
		name: string;
		enabled: boolean;
		running: boolean;
		cronSchedule: string;
		scheduled: boolean;
	}> {
		return config.instances.map((instance) => ({
			name: instance.name,
			enabled: instance.enabled,
			running: this.runningJobs.has(instance.name),
			cronSchedule: instance.cronSchedule,
			scheduled: this.jobs.has(instance.name),
		}));
	}

	/**
	 * Log scheduled instances (nextDate() not available in node-cron)
	 */
	private logNextRunTimes(): void {
		logger.info("📅 Scheduled instances:");
		for (const [name] of this.jobs) {
			const instance = config.instances.find((i) => i.name === name);
			if (instance) {
				logger.info(
					`  • ${name}: ${instance.cronSchedule} (${config.globalSettings.timezone})`,
				);
			}
		}
	}

	/**
	 * Setup graceful shutdown handlers
	 */
	private setupSignalHandlers(): void {
		const shutdown = (signal: string) => {
			logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
			this.stopAll();

			// Wait for running jobs to complete (max 30 seconds)
			const waitForJobs = async () => {
				const maxWait = 30000; // 30 seconds
				const checkInterval = 1000; // 1 second
				let waited = 0;

				while (this.runningJobs.size > 0 && waited < maxWait) {
					logger.info(
						`⏳ Waiting for ${this.runningJobs.size} running job(s) to complete...`,
					);
					await new Promise((resolve) => setTimeout(resolve, checkInterval));
					waited += checkInterval;
				}

				if (this.runningJobs.size > 0) {
					logger.warn(
						`⚠️  Force shutting down with ${this.runningJobs.size} job(s) still running`,
					);
				}

				process.exit(0);
			};

			waitForJobs();
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
	}

	/**
	 * Run a specific instance immediately (for testing)
	 */
	public async runInstanceNow(instanceName: string): Promise<void> {
		const instance = config.instances.find((i) => i.name === instanceName);
		if (!instance) {
			throw new Error(`Instance '${instanceName}' not found`);
		}

		if (!instance.enabled) {
			throw new Error(`Instance '${instanceName}' is disabled`);
		}

		await this.executeInstance(instance);
	}
}

export default ZurgScheduler;
