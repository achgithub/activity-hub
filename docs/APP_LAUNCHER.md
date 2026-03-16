# Unix Socket App Launcher

## Overview

The Activity Hub App Launcher is a dynamic mini-app lifecycle management system that:

- **Launches apps on-demand** when users click tiles or accept game challenges
- **Uses Unix domain sockets** instead of TCP ports to avoid port proliferation
- **Auto-shuts down apps** after 10 minutes of inactivity to save resources
- **Monitors app health** with automatic crash detection and restart
- **Transparently proxies** HTTP requests through Unix sockets

## Benefits

| Feature | Before | After |
|---------|--------|-------|
| **Port Usage** | 22+ ports (4001-4091, 5010-5081) | 1 port (3001) + Unix sockets |
| **Memory** | All apps running 24/7 | Only active apps loaded |
| **Start Time** | 30+ seconds | <5 seconds per app |
| **Auto-recovery** | Manual restart | Automatic crash detection & restart |
| **Configuration** | Hardcoded ports | Environment-driven |

## How It Works

### App Launch Flow

```
User clicks app tile
    ↓
Frontend: POST /api/apps/{appId}/launch
    ↓
Backend launcher spawns process with env vars:
  - APP_ID={appId}
  - SOCKET_PATH=/tmp/activity-hub-{appId}.sock
  - DB_HOST, DB_USER, DB_PASS (inherited)
  - REDIS_HOST, REDIS_PORT (inherited)
    ↓
App starts and listens on Unix socket
    ↓
Frontend: GET /api/apps/{appId}/proxy/
    ↓
Proxy handler forwards HTTP through socket
    ↓
App response returned to browser/iframe
    ↓
User sees app loaded in iframe
```

### Request Proxying

The proxy handler translates HTTP requests:

```
Browser Request:
GET /api/apps/tic-tac-toe/proxy/api/game/abc?gameId=xyz

↓ Proxy extracts and rewrites:

Unix Socket Request:
GET /api/game/abc?gameId=xyz
(sent through /tmp/activity-hub-tic-tac-toe.sock)

↓ App processes request and returns response

↓ Proxy forwards response back to browser
```

## Lifecycle Management

### Idle Timeout

- **Monitoring**: Launcher checks every 5 minutes
- **Threshold**: 10 minutes since last request
- **Action**: Graceful shutdown (SIGTERM)
- **Timeout**: 30 seconds to shut down, then SIGKILL
- **Cleanup**: Socket file removed

### Health Checks

- **Frequency**: Every 30 seconds
- **Method**: HTTP GET /api/health through socket
- **Failures**: After 3 consecutive failures, app marked as crashed
- **Auto-restart**: Automatic restart (max 3 attempts)
- **Logging**: Events logged to `app_lifecycle_events` table

### App States

```
launching  →  running
             ↓
             idle  (if no activity for 10min)
             ↓
        shutting_down  →  removed
             ↑
          crashed  →  restarting  (max 3 times)
             ↓
          crashed (final)
```

## Configuration

### Environment Variables

Set when launcher spawns process:

```bash
# Core
APP_ID=tic-tac-toe
SOCKET_PATH=/tmp/activity-hub-tic-tac-toe.sock
ACTIVITY_HUB_URL=http://localhost:3000

# Database (shared)
DB_HOST=127.0.0.1
DB_PORT=5555
DB_USER=activityhub
DB_PASS=pubgames

# Redis (shared)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Optional (games only)
GAME_ID=abc123  (if single-game-per-process model)
```

### App Code

Minimal change required in app's `main.go`:

```go
func main() {
    socketPath := os.Getenv("SOCKET_PATH")
    if socketPath != "" {
        // Unix socket mode (production)
        listener, _ := net.Listen("unix", socketPath)
        os.Chmod(socketPath, 0666)
        http.Serve(listener, handler)
    } else {
        // TCP mode (development fallback)
        port := getEnv("PORT", "4001")
        http.ListenAndServe(":"+port, handler)
    }
}
```

## API Endpoints

### Launch App

```bash
POST /api/apps/{appId}/launch
Query: ?gameId=xyz (optional)

Response:
{
  "success": true,
  "appId": "tic-tac-toe",
  "message": "App launched successfully"
}
```

### Stop App

```bash
POST /api/apps/{appId}/stop

Response:
{
  "success": true
}
```

### Check Health

```bash
GET /api/apps/{appId}/health

Response:
{
  "appId": "tic-tac-toe",
  "status": "running",
  "healthy": true,
  "pid": 12345,
  "startedAt": "2026-03-16T10:30:45Z",
  "lastActivity": "2026-03-16T10:35:12Z"
}
```

### Get Running Apps

```bash
GET /api/apps/running

Response:
{
  "apps": [
    {
      "appId": "tic-tac-toe",
      "pid": 12345,
      "status": "running",
      "startedAt": "2026-03-16T10:30:45Z",
      "lastActivity": "2026-03-16T10:35:12Z",
      "idleSeconds": 327,
      "socketPath": "/tmp/activity-hub-tic-tac-toe.sock",
      "restartCount": 0
    }
  ],
  "count": 1
}
```

### HTTP Proxy

```bash
GET|POST|PUT|DELETE /api/apps/{appId}/proxy/*
Query: ?gameId=xyz (passed to app)

# Transparently forwards all requests through Unix socket
# All app endpoints work normally
```

## Development

### Local Testing (TCP Mode)

Apps continue to work in TCP mode during development:

```bash
# Set PORT env var instead of SOCKET_PATH
export PORT=4001

# Run app normally
go run *.go

# Access via http://localhost:4001
```

### Production Testing (Socket Mode)

On Pi, set `SOCKET_PATH`:

```bash
export SOCKET_PATH=/tmp/activity-hub-tic-tac-toe.sock

# Compile binary
go build -o tic-tac-toe-app .

# Launcher will start it automatically on first request
```

## Monitoring

### Database Logging

Track app events:

```sql
SELECT * FROM app_lifecycle_events
WHERE app_id = 'tic-tac-toe'
ORDER BY created_at DESC
LIMIT 20;
```

Event types: `launched`, `stopped`, `crashed`, `health_check_failed`

### Log Output

Each app logs to stdout:

```
✅ Launched app tic-tac-toe (PID 12345) on socket /tmp/activity-hub-tic-tac-toe.sock
⚠️  Health check failed for tic-tac-toe: unhealthy: status 500
💥 App tic-tac-toe crashed (restart 1/3)
✅ App tic-tac-toe shut down gracefully
```

## Troubleshooting

### App Won't Start

1. **Check socket path**: Verify `/tmp/activity-hub-{appId}.sock` doesn't exist
2. **Check binary**: Ensure `./apps/{appId}/backend/{appId}-app` exists
3. **Check logs**: Look at backend logs for environment errors
4. **Check permissions**: Socket needs 0666 permissions

### Health Checks Failing

1. **Check if app is responding**: `curl --unix-socket /tmp/activity-hub-{appId}.sock http://unix/api/health`
2. **Check firewall**: Ensure socket access isn't blocked
3. **Check app logs**: App may be unable to connect to DB/Redis

### App Crashes Repeatedly

1. **Check database**: Ensure app database exists and is initialized
2. **Check Redis**: Ensure Redis is running and accessible
3. **Increase timeout**: Launch takes time on slow systems, adjust LaunchTimeout constant
4. **Check logs**: Review stdout from the process

## Migration Checklist

- [ ] Apps compile to binaries (not `go run`)
- [ ] Apps support SOCKET_PATH environment variable
- [ ] Apps have /api/health endpoint
- [ ] Database schema is initialized on Pi
- [ ] Frontend uses `/api/apps/{appId}/proxy/` URLs
- [ ] Awareness service integrated (for multiplayer games)
- [ ] Old tmux/port-based scripts removed

## See Also

- [Awareness Service Guide](./AWARENESS_SERVICE.md)
- [Mini-App Integration Guide](./MINI_APP_INTEGRATION.md)
