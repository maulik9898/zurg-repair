# Zurg File Repair Tool

Automated tool to detect and repair broken files in Zurg torrents with support for multiple instances and cron scheduling.

## What This Does

- **Monitors Zurg instances** for broken torrent files
- **Automatically repairs** corrupted or missing file segments  
- **Supports multiple instances** with individual scheduling
- **Runs on cron schedules** for automated maintenance
- **Provides detailed logging** of all operations

## Quick Start with Docker

### 1. Create Configuration File

Create `config/config.yaml`:

```yaml
instances:
  main:
    baseUrl: "http://localhost:9999/"
    concurrencyLimit: 10
    cronSchedule: "0 */6 * * *"  # Every 6 hours
    enabled: true
    retryAttempts: 3
    retryDelay: 2000

globalSettings:
  logLevel: "info"
  timezone: "UTC"
```

### 2. Run with Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f zurg-repair

# Stop the service
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SCHEDULER_MODE` | Enable cron scheduling (`true`/`false`) | `true` |
| `ZURG_CONFIG_FILE` | Path to YAML config file | `/config/config.yaml` |
| `RUN_INSTANCE` | Run specific instance only | All enabled instances |
| `LOG_LEVEL` | Log level (`error`/`warn`/`info`/`debug`) | `info` |
| `TZ` | Timezone for cron scheduling | `UTC` |

### Instance Configuration

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `baseUrl` | string | Zurg instance URL | `"http://zurg:9999/"` |
| `concurrencyLimit` | number | Max concurrent repairs (1-100) | `10` |
| `cronSchedule` | string | Cron expression for scheduling | `"0 */6 * * *"` |
| `enabled` | boolean | Enable/disable this instance | `true` |
| `retryAttempts` | number | Max retry attempts (1-10) | `3` |
| `retryDelay` | number | Delay between retries (ms) | `2000` |

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `logLevel` | Logging level | `"info"` |
| `timezone` | Timezone for cron jobs | `"UTC"` |

## Docker Usage

### Development (Local Build)

```bash
# Build and run from source
docker-compose up --build

# Or use the dev-specific file
docker-compose -f docker-compose.dev.yml up --build

# View logs
docker-compose logs -f
```

### Production (Published Image)

**Option 1: Embedded Configuration (Recommended)**
```bash
# Uses embedded config in docker-compose file
docker-compose -f docker-compose.prod.yml up -d

# Pull latest image and restart
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Option 2: External Configuration File**
```bash
# Uses external config file (requires config/config.yaml)
docker-compose -f docker-compose.prod-external.yml up -d

# View logs
docker-compose -f docker-compose.prod-external.yml logs -f
```

### One-Time Execution

```bash
# Run all enabled instances once
docker run --rm \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  -e SCHEDULER_MODE=false \
  ghcr.io/maulik9898/zurg-repair:latest

# Run specific instance only
docker run --rm \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  -e SCHEDULER_MODE=false \
  -e RUN_INSTANCE=main \
  ghcr.io/maulik9898/zurg-repair:latest
```

## Configuration Examples

### Single Instance

```yaml
instances:
  production:
    baseUrl: "http://zurg.local:9999/"
    concurrencyLimit: 15
    cronSchedule: "0 2,8,14,20 * * *"  # Every 6 hours
    enabled: true

globalSettings:
  logLevel: "info"
  timezone: "America/New_York"
```

### Multiple Instances

```yaml
instances:
  plex:
    baseUrl: "http://192.168.1.100:9999/"
    concurrencyLimit: 20
    cronSchedule: "0 */6 * * *"  # Every 6 hours
    enabled: true
    retryAttempts: 3
    retryDelay: 2000

  backup:
    baseUrl: "http://192.168.1.101:9999/"
    concurrencyLimit: 10
    cronSchedule: "0 3 * * *"   # Daily at 3 AM
    enabled: true
    retryAttempts: 2
    retryDelay: 1500

  testing:
    baseUrl: "http://test-zurg:9999/"
    concurrencyLimit: 5
    cronSchedule: "*/15 * * * *"  # Every 15 minutes
    enabled: false

globalSettings:
  logLevel: "debug"
  timezone: "UTC"
```

## Cron Schedule Examples

| Expression | Description |
|------------|-------------|
| `"0 */6 * * *"` | Every 6 hours |
| `"0 2 * * *"` | Daily at 2:00 AM |
| `"*/30 * * * *"` | Every 30 minutes |
| `"0 6,18 * * *"` | 6 AM and 6 PM daily |
| `"0 9 * * 1-5"` | 9 AM on weekdays |

## Operations

### Viewing Logs

```bash
# Follow logs in real-time
docker-compose logs -f zurg-repair

# View recent logs
docker logs zurg-repair

# Save logs to file
docker-compose logs zurg-repair > zurg-repair.log
```

### Health Monitoring

The application provides health status updates every 5 minutes showing:
- Number of running instances
- Instance status and next execution times
- Any errors or warnings

### Manual Operations

```bash
# Check configuration without running
docker run --rm \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  -e SCHEDULER_MODE=false \
  -e LOG_LEVEL=debug \
  ghcr.io/maulik9898/zurg-repair:latest

# Test specific instance
docker run --rm \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  -e SCHEDULER_MODE=false \
  -e RUN_INSTANCE=plex \
  -e LOG_LEVEL=debug \
  ghcr.io/maulik9898/zurg-repair:latest
```

## Building from Source

### Requirements
- [Bun](https://bun.sh) runtime
- Docker (for containerization)

### Local Development

```bash
# Install dependencies
bun install

# Run with config
ZURG_CONFIG_FILE=config/config.yaml bun src/index.ts

# One-time execution
SCHEDULER_MODE=false ZURG_CONFIG_FILE=config/config.yaml bun src/index.ts
```

### Docker Build

```bash
# Build image
docker build -t zurg-repair .

# Test run
docker run -v $(pwd)/config/config.yaml:/config/config.yaml zurg-repair
```

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| Config file not found | Check file path and Docker volume mount |
| Connection refused | Verify Zurg URL is accessible from container |
| Invalid cron expression | Use [crontab.guru](https://crontab.guru) to validate |
| Permission denied | Check file permissions on config file |

### Debug Mode

```bash
# Enable debug logging
docker run -e LOG_LEVEL=debug \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  ghcr.io/maulik9898/zurg-repair:latest
```

### Configuration Validation

```bash
# Test configuration syntax
docker run --rm \
  -v $(pwd)/config/config.yaml:/config/config.yaml:ro \
  -e SCHEDULER_MODE=false \
  -e LOG_LEVEL=debug \
  ghcr.io/maulik9898/zurg-repair:latest
```

## License

MIT License