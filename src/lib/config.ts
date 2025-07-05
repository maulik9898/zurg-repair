import { z } from 'zod';
import yaml from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Schema for a single Zurg instance (without name)
const zurgInstanceSchema = z.object({
    baseUrl: z.string().url("Must be a valid URL"),
    concurrencyLimit: z.number().int().min(1).max(100).default(10),
    cronSchedule: z.string().min(1, "Cron schedule is required"),
    enabled: z.boolean().default(true),
    retryAttempts: z.number().int().min(1).max(10).default(3),
    retryDelay: z.number().int().min(100).max(60000).default(2000), // ms
});

// Compose-style: instances is a record of name -> config
const configSchema = z.object({
    instances: z.record(zurgInstanceSchema),
    globalSettings: z.object({
        logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
        timezone: z.string().default('UTC'),
    }).default({}),
});

// Default configuration if no YAML file is provided
const defaultConfig = {
    instances: {
        default: {
            baseUrl: process.env.ZURG_BASE_URL || "http://localhost:9999",
            concurrencyLimit: parseInt(process.env.CONCURRENCY_LIMIT || "10"),
            cronSchedule: process.env.CRON_SCHEDULE || "0 */6 * * *", // Every 6 hours
            enabled: true,
            retryAttempts: 3,
            retryDelay: 2000,
        }
    },
    globalSettings: {
        logLevel: (process.env.LOG_LEVEL || 'info') as any,
        timezone: process.env.TZ || 'UTC',
    }
};

// Load and parse YAML configuration file
function loadConfigFromFile(filePath: string) {
    try {
        const resolvedPath = resolve(filePath);

        if (!existsSync(resolvedPath)) {
            throw new Error(`Configuration file not found: ${resolvedPath}`);
        }

        console.info(`📄 Loading configuration from: ${resolvedPath}`);
        const fileContent = readFileSync(resolvedPath, 'utf8');
        const parsed = yaml.load(fileContent);

        return configSchema.parse(parsed);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`❌ Failed to load configuration file: ${error.message}`);
        } else {
            console.error(`❌ Failed to load configuration file: ${String(error)}`);
        }
        throw error;
    }
}

// Parse configuration from file path, environment variable, or use defaults
function parseConfig() {
    const configFile = process.env.ZURG_CONFIG_FILE;
    const yamlContent = process.env.ZURG_CONFIG_YAML; // For backward compatibility

    if (configFile) {
        try {
            return loadConfigFromFile(configFile);
        } catch (error) {
            console.error("❌ Failed to load config file, falling back to default configuration");
            return configSchema.parse(defaultConfig);
        }
    }

    if (yamlContent) {
        console.warn("⚠️  ZURG_CONFIG_YAML is deprecated, use ZURG_CONFIG_FILE instead");
        try {
            const parsed = yaml.load(yamlContent);
            return configSchema.parse(parsed);
        } catch (error) {
            console.error("❌ Failed to parse ZURG_CONFIG_YAML:", error);
            console.warn("⚠️  Falling back to default configuration");
            return configSchema.parse(defaultConfig);
        }
    }

    console.warn("⚠️  No ZURG_CONFIG_FILE specified, using default configuration");
    console.info("💡 Set ZURG_CONFIG_FILE environment variable to use a custom configuration file");
    return configSchema.parse(defaultConfig);
}

// After parsing, convert the object to an array of { name, ...config } for downstream use
const rawConfig = parseConfig();
export const config = {
    ...rawConfig,
    instances: Object.entries(rawConfig.instances).map(([name, instance]) => ({ name, ...instance })),
};

// Export types for use in other modules
export type ZurgInstance = z.infer<typeof zurgInstanceSchema> & { name: string };
export type Config = typeof config;

// Legacy export for backward compatibility
export default {
    ZURG_BASE_URL: config.instances[0]?.baseUrl || "http://localhost:9999",
    CONCURRENCY_LIMIT: config.instances[0]?.concurrencyLimit || 10,
};