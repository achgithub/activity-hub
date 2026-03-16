# Redis Setup and Configuration

## Overview

Activity Hub uses Redis for real-time features:
- User presence tracking (heartbeats, status)
- Challenge queuing and notifications
- Multiplayer session management
- SSE (Server-Sent Events) coordination

Redis does NOT require a schema - it's a key-value store. Configuration is done via environment variables and runtime key patterns.

---

## Installation on Raspberry Pi

### Step 1: Install Redis

```bash
# Update package manager
sudo apt-get update

# Install Redis server
sudo apt-get install -y redis-server

# Verify installation
redis-cli --version
```

### Step 2: Configure Redis

Edit `/etc/redis/redis.conf`:

```bash
sudo nano /etc/redis/redis.conf
```

Key settings (defaults are usually fine, but verify):

```conf
# Network
bind 127.0.0.1                    # Listen only on localhost
port 6379                         # Default port
tcp-backlog 511

# Memory
maxmemory 256mb                   # Limit to 256MB (adjust for Pi capacity)
maxmemory-policy allkeys-lru      # Evict least-recently-used keys when full

# Persistence (Optional - NOT NEEDED for activity-hub)
# save "" or comment out all save lines (no disk persistence needed)
appendonly no                      # Don't append-only file

# Logging
loglevel notice
logfile "/var/log/redis/redis-server.log"

# Client handling
timeout 0                         # Don't disconnect idle clients
tcp-keepalive 300

# Advanced
databases 16                      # Number of databases (we use db 0)
```

### Step 3: Start Redis Service

```bash
# Enable auto-start on boot
sudo systemctl enable redis-server

# Start the service
sudo systemctl start redis-server

# Verify it's running
sudo systemctl status redis-server

# Test connectivity
redis-cli ping
# Should return: PONG
```

### Step 4: Verify Redis is Working

```bash
# Connect to Redis CLI
redis-cli

# Inside redis-cli, test basic commands
redis> SET test-key "hello"
OK

redis> GET test-key
"hello"

redis> DEL test-key
(integer) 1

redis> EXIT
```

---

## Environment Variables (activity-hub Backend)

The backend connects to Redis using environment variables:

```bash
# In ~/.bashrc or systemd service file
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_PASSWORD=""              # Leave empty if no password (default)
export REDIS_DB=0                     # Database number (0 = default)
```

If Redis has authentication:

```bash
export REDIS_PASSWORD=your-secure-password
```

---

## Key Patterns and Data Structures

### 1. User Presence (30-second TTL)

**Key:** `user:presence:{email}`

**Type:** Hash

**Structure:**
```json
{
  "email": "alice@test.com",
  "displayName": "Alice",
  "status": "online",           // online, in_game, away, offline, do_not_disturb
  "currentApp": "tic-tac-toe",
  "lastSeen": 1710586200
}
```

**TTL:** 30 seconds (auto-expires if no heartbeat)

**Usage:**
- Backend updates every 20 seconds (heartbeat from client)
- If TTL expires, user is considered offline
- Used by `/api/awareness/users` endpoint

**Example CLI:**
```bash
redis-cli HGETALL user:presence:alice@test.com
redis-cli TTL user:presence:alice@test.com
redis-cli EXPIRE user:presence:alice@test.com 30
```

### 2. Challenge Queues (5-minute TTL)

**Key (Received):** `user:challenges:received:{email}`

**Key (Sent):** `user:challenges:sent:{email}`

**Type:** List (Redis list of challenge IDs)

**Structure:**
```
user:challenges:received:alice@test.com = [
  "challenge-uuid-1",
  "challenge-uuid-2",
  ...
]
```

**TTL:** 5 minutes

**Usage:**
- Track incoming challenges for a user
- Track outgoing challenges sent by a user
- Used by challenge UI to show pending challenges
- Cleaned up on accept/reject or TTL expiration

**Example CLI:**
```bash
redis-cli LPUSH user:challenges:received:alice@test.com "challenge-123"
redis-cli LRANGE user:challenges:received:alice@test.com 0 -1
redis-cli EXPIRE user:challenges:received:alice@test.com 300
```

### 3. Challenge Details (60-120 second TTL)

**Key:** `challenge:{id}`

**Type:** Hash (JSON structure stored in Redis)

**Structure:**
```json
{
  "id": "challenge-uuid",
  "fromUser": "alice@test.com",
  "toUser": "bob@test.com",
  "initiatorId": null,           // For multi-player
  "playerIds": [],               // For multi-player
  "appId": "tic-tac-toe",
  "status": "pending",           // pending, active, rejected, expired
  "minPlayers": 2,
  "maxPlayers": 2,
  "options": {...},              // Game-specific options
  "expiresAt": 1710586260
}
```

**TTL:** 60 seconds (2-player), 120 seconds (multi-player)

**Usage:**
- Store challenge details for quick lookup
- Auto-expire if not accepted within TTL
- Used by both 2-player (legacy) and multi-player (new) systems

**Example CLI:**
```bash
redis-cli HSET challenge:abc "id" "abc" "fromUser" "alice@test.com" "status" "pending"
redis-cli HGETALL challenge:abc
redis-cli EXPIRE challenge:abc 120
```

### 4. User Notifications (Pub/Sub Channels)

**Channel:** `presence:updates`

**Type:** Pub/Sub (ephemeral, no persistence)

**Message:**
```json
{
  "type": "user_online",        // or: user_offline, presence_update
  "data": {
    "email": "alice@test.com",
    "displayName": "Alice",
    "status": "online"
  }
}
```

**Usage:**
- Real-time notifications to connected clients
- Broadcast when user goes online/offline
- Broadcast when user changes status
- Used by SSE streams to push updates

**Example CLI:**
```bash
# Subscribe (in one terminal)
redis-cli
redis> SUBSCRIBE presence:updates

# Publish (in another terminal)
redis> PUBLISH presence:updates '{"type":"user_online","data":{"email":"alice@test.com"}}'
```

### 5. User-Specific Notifications (Pub/Sub Channel)

**Channel:** `user:{email}` (per-user notifications)

**Type:** Pub/Sub

**Messages:**
- New challenge received
- Challenge accepted/rejected
- Game session updates
- Status changes from other users

**Example CLI:**
```bash
# Subscribe to alice's notifications
redis-cli SUBSCRIBE user:alice@test.com

# Publish to alice
redis-cli PUBLISH user:alice@test.com '{"type":"challenge_received","data":{...}}'
```

### 6. Session Participants (1-hour TTL)

**Key:** `session:{appId}:{sessionId}`

**Type:** Hash

**Structure:**
```json
{
  "appId": "tic-tac-toe",
  "sessionId": "game-123",
  "participants": [
    {
      "userId": "alice@test.com",
      "status": "active",          // active, grace_period, left
      "joinedAt": 1710586200
    },
    {
      "userId": "bob@test.com",
      "status": "active",
      "joinedAt": 1710586205
    }
  ]
}
```

**TTL:** 1 hour (long-lived for ongoing games)

**Usage:**
- Track who's in a multiplayer game session
- Support grace period (30s reconnection window)
- Used by session awareness tracking

---

## Monitoring Redis

### Check Memory Usage

```bash
redis-cli INFO memory
```

Output shows:
- `used_memory_human` - Current memory usage
- `maxmemory` - Max allowed (256MB on Pi)
- `evicted_keys` - Keys removed due to maxmemory policy

### Monitor Real-Time Activity

```bash
# Watch commands being executed
redis-cli MONITOR

# Will show all commands in real-time (verbose)
```

### Check Key Expiration

```bash
# Count keys by pattern
redis-cli KEYS "user:presence:*" | wc -l

# Check TTL of specific key
redis-cli TTL user:presence:alice@test.com

# -1 = no expiration, -2 = key doesn't exist
```

### Flush Database (DANGER - only for testing)

```bash
# Clear ALL data in Redis
redis-cli FLUSHDB

# Confirm with password
redis-cli FLUSHDB AUTH password

# Verify it's empty
redis-cli DBSIZE
# Should return: (integer) 0
```

---

## Troubleshooting

### Redis Not Starting

```bash
# Check logs
tail -f /var/log/redis/redis-server.log

# Common issues:
# - Port 6379 already in use
# - /var/run/redis directory missing
# - Permission issues on /var/log/redis/

# Restart service
sudo systemctl restart redis-server
```

### Backend Can't Connect to Redis

```bash
# Test connectivity from command line
redis-cli ping

# If no response, check:
# 1. Redis service is running: sudo systemctl status redis-server
# 2. Port is correct: netstat -an | grep 6379
# 3. Firewall allows 127.0.0.1:6379
# 4. Environment variables set correctly: echo $REDIS_HOST $REDIS_PORT
```

### Out of Memory Errors

```bash
# Check current memory usage
redis-cli INFO memory | grep used_memory_human

# Options to fix:
# 1. Increase maxmemory in /etc/redis/redis.conf
# 2. Reduce TTL values for presence keys
# 3. Add more RAM to Pi
# 4. Implement cleanup scripts for old data
```

### Keys Not Expiring

```bash
# Check key TTL
redis-cli TTL user:presence:alice@test.com

# If TTL is -1, key has no expiration (shouldn't happen)
# If TTL is -2, key doesn't exist

# Manually set expiration
redis-cli EXPIRE user:presence:alice@test.com 30
```

---

## Backup and Recovery (Optional)

Redis persistence is DISABLED for activity-hub (not needed for session data).

If you want persistence (not recommended for this use case):

```bash
# Enable RDB snapshots
redis-cli SAVE                    # Manual snapshot
redis-cli BGSAVE                  # Background snapshot

# Enable AOF (append-only file)
# Edit /etc/redis/redis.conf:
# appendonly yes
# appendfsync everysec
```

For activity-hub, session data loss is acceptable (users simply reconnect).

---

## Performance Tuning

### Memory Optimization

Current settings for Raspberry Pi:
- `maxmemory: 256mb` - Adjust based on Pi RAM
- `maxmemory-policy: allkeys-lru` - Remove least-used keys first
- Presence TTL: 30s (auto-cleanup)
- Challenge TTL: 60-120s (auto-cleanup)

### Network Optimization

```conf
# In /etc/redis/redis.conf
tcp-keepalive 300          # Detect dead connections
tcp-backlog 511            # Accept queue
timeout 0                  # Don't disconnect idle clients
```

### Persistence (if enabled)

```conf
# Save snapshots only when needed
save 900 1                 # Save if 1 key changed in 900s
save 300 10                # Save if 10 keys changed in 300s
save 60 10000              # Save if 10000 keys changed in 60s

# Or disable for this use case:
save ""
```

---

## Testing Redis Connection (Go)

Activity Hub backend code example:

```go
import "github.com/go-redis/redis/v8"

func initRedis() *redis.Client {
    client := redis.NewClient(&redis.Options{
        Addr:     fmt.Sprintf("%s:%s", os.Getenv("REDIS_HOST"), os.Getenv("REDIS_PORT")),
        Password: os.Getenv("REDIS_PASSWORD"),
        DB:       0,
    })

    // Test connection
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := client.Ping(ctx).Err(); err != nil {
        log.Fatal("Redis connection failed:", err)
    }

    log.Println("✅ Connected to Redis")
    return client
}
```

---

## Summary

Redis Setup Checklist for Pi:

- [ ] Redis installed: `sudo apt-get install redis-server`
- [ ] Configured at `/etc/redis/redis.conf`
- [ ] Service enabled: `sudo systemctl enable redis-server`
- [ ] Service running: `sudo systemctl start redis-server`
- [ ] Test connectivity: `redis-cli ping` → `PONG`
- [ ] Environment variables set: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- [ ] Backend code uses correct connection string
- [ ] Monitoring in place: `redis-cli MONITOR` or `INFO memory`
- [ ] No persistence needed (auto-cleanup via TTL)

No schema needed - Redis is schemaless. Keys and TTLs are managed by application code.
