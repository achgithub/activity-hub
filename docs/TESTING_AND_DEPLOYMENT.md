# Testing and Deployment Guide

## Pre-Deployment Checklist

### Database

```bash
# On Pi, run migrations
psql -U activityhub -d activity_hub << 'SQL'
-- App Launcher Schema
CREATE TABLE IF NOT EXISTS app_lifecycle_events (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    pid INT,
    game_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_app_lifecycle_app ON app_lifecycle_events(app_id, created_at DESC);
CREATE INDEX idx_app_lifecycle_event ON app_lifecycle_events(event_type, created_at DESC);

-- Awareness Service Schema
CREATE TABLE IF NOT EXISTS awareness_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(100),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_awareness_user_time ON awareness_events(user_id, created_at DESC);
CREATE INDEX idx_awareness_event_time ON awareness_events(event_type, created_at DESC);
CREATE INDEX idx_awareness_session_time ON awareness_events(app_id, session_id, created_at DESC);
SQL

# Verify tables
psql -U activityhub -d activity_hub -c "\dt"
```

### Code Deployment

```bash
# On Pi
cd ~/activity-hub
git pull

# Build all apps
./scripts/build_apps.sh

# Verify binaries exist
ls -la apps/*/backend/*-app

# Verify activity-hub backend starts
go run backend/main.go
# Should see:
# ✅ Connected to PostgreSQL database
# ✅ Connected to Redis
# Identity Shell Backend starting on :3001
```

## Phase 1: Backend App Launcher Testing

### Test 1: App Launches On-Demand

```bash
# Terminal 1: Monitor processes
watch -n 1 "ls -la /tmp/activity-hub-*.sock"

# Terminal 2: Launch app
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch

# Expected:
# ✅ Socket file created: /tmp/activity-hub-tic-tac-toe.sock
# ✅ Backend logs: "✅ Launched app tic-tac-toe (PID xxxxx)"
```

### Test 2: Health Check Works

```bash
# Check app health via health endpoint
curl http://localhost:3001/api/apps/tic-tac-toe/health

# Expected response:
{
  "appId": "tic-tac-toe",
  "status": "running",
  "healthy": true,
  "pid": 12345,
  "startedAt": "2026-03-16T10:30:45Z",
  "lastActivity": "2026-03-16T10:35:12Z"
}
```

### Test 3: HTTP Proxy Works

```bash
# Test proxy to app's health endpoint
curl http://localhost:3001/api/apps/tic-tac-toe/proxy/api/health

# Expected: Same response as app's direct health check
{
  "status": "ok",
  "app": "tic-tac-toe",
  "timestamp": "2026-03-16T10:35:12Z"
}
```

### Test 4: Idle Timeout (10 minutes)

```bash
# Launch app
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch

# Wait 10+ minutes (or monitor lifecycle events in DB)
psql -U activityhub -d activity_hub \
  -c "SELECT * FROM app_lifecycle_events WHERE app_id='tic-tac-toe' ORDER BY created_at;"

# After 10 minutes, verify:
# - New event: "stopped"
# - Socket file deleted: ls /tmp/activity-hub-tic-tac-toe.sock (should not exist)

# Launch again - should work
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch
```

### Test 5: Health Check Failure and Restart

```bash
# Launch app
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch

# Get PID from running apps
curl http://localhost:3001/api/apps/running | jq '.apps[0].pid'

# Kill the app (simulating crash)
kill -9 <PID>

# Wait for health check to fail (30s interval)
# Monitor logs and database

# After 3 failures, verify:
# - Event: "crashed"
# - App auto-restarts

# Make request to trigger restart if needed
curl http://localhost:3001/api/apps/tic-tac-toe/proxy/api/health

# Verify new PID
curl http://localhost:3001/api/apps/running | jq '.apps[0].pid'
```

### Test 6: Stop App

```bash
# Launch app
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch

# Stop it
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/stop

# Expected:
# ✅ App stopped gracefully
# ✅ Socket deleted
# ✅ Event logged: "stopped"

# Verify
curl http://localhost:3001/api/apps/running
# Should not include tic-tac-toe
```

## Phase 2: Awareness Service Testing

### Test 1: Heartbeat and Presence

```bash
# Terminal 1: Monitor presence updates
curl http://localhost:3001/api/awareness/stream
# Should see SSE events (one per heartbeat)

# Terminal 2: Send heartbeat
curl -X POST http://localhost:3001/api/awareness/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@test.com",
    "displayName": "Alice",
    "status": "online",
    "currentApp": "tic-tac-toe",
    "platform": "web"
  }'

# Expected:
# ✅ Terminal 1 receives: {"type": "presence_update", ...}
# ✅ Database: INSERT into awareness_events (heartbeat event)
```

### Test 2: Status Change

```bash
# Change status (requires token)
curl -X POST http://localhost:3001/api/awareness/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-alice@test.com" \
  -d '{"status": "away"}'

# Expected:
# ✅ Response: {"success": true, "status": "away"}
# ✅ SSE subscribers receive status_change event
```

### Test 3: Session Join/Leave

```bash
# Join session
curl -X POST http://localhost:3001/api/awareness/sessions/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-alice@test.com" \
  -d '{
    "appId": "tic-tac-toe",
    "sessionId": "game-123"
  }'

# Expected:
# ✅ Response: {"success": true, "message": "Joined session"}
# ✅ Database: awareness_events (session_join event)

# Check participants
curl http://localhost:3001/api/awareness/sessions/tic-tac-toe/game-123

# Expected:
{
  "participants": [
    {
      "userId": "alice@test.com",
      "displayName": "Alice",
      "joinedAt": 1710586100,
      "status": "active"
    }
  ],
  "count": 1
}

# Leave session
curl -X POST http://localhost:3001/api/awareness/sessions/leave \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-alice@test.com" \
  -d '{
    "appId": "tic-tac-toe",
    "sessionId": "game-123"
  }'

# Expected:
# ✅ Response: {"success": true, "message": "Left session (grace period active)"}
# ✅ Participant status changes to "grace_period"
# ✅ After 30s, status changes to "left"
```

### Test 4: Grace Period Reconnection

```bash
# User 1 joins session
curl -X POST http://localhost:3001/api/awareness/sessions/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-alice@test.com" \
  -d '{"appId": "tic-tac-toe", "sessionId": "game-456"}'

# User 2 joins
curl -X POST http://localhost:3001/api/awareness/sessions/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-bob@test.com" \
  -d '{"appId": "tic-tac-toe", "sessionId": "game-456"}'

# User 1 leaves (grace period starts)
curl -X POST http://localhost:3001/api/awareness/sessions/leave \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token-alice@test.com" \
  -d '{"appId": "tic-tac-toe", "sessionId": "game-456"}'

# Check - Alice should be in grace_period
curl http://localhost:3001/api/awareness/sessions/tic-tac-toe/game-456 | jq

# User 1 rejoins within 30s (if implementation has reconnect endpoint)
# After 30s without reconnect, Alice moves to "left"
```

## Phase 3: Frontend and UI Testing

### Test 1: App Tile Click and Launch

```
1. Open browser: http://localhost:3001
2. Login as test user
3. Click app tile (e.g., "Leaderboard")
4. Expected:
   - Shell navigates to /app/leaderboard
   - AppContainer shows "🚀 Launching..."
   - After 2-3 seconds, app loads in iframe
   - No console errors
```

### Test 2: Game Launch with Challenge

```
1. Login as User A
2. Click game tile (e.g., "Tic-Tac-Toe")
3. Send challenge to User B
4. Login as User B (new window)
5. Accept challenge
6. Expected:
   - Challenge accepted
   - Backend creates game session
   - User B sees game loading
   - After 2-3 seconds, game loads
   - SessionParticipants component shows both players
   - Status: Alice (You) ✅ In Game, Bob ✅ In Game
```

### Test 3: Multiplayer Session Updates

```
During Tic-Tac-Toe game:
1. User A makes a move
2. User B browser should show real-time update (SSE)
3. If User B closes/refreshes within grace period:
   - Status shows ⏳ Reconnecting...
   - After 30s, status shows ❌ Left
4. If User B refreshes within 30s:
   - Status remains ✅ In Game
   - Game session preserved
```

### Test 4: Presence Badge in Header

```
1. Login as User A
2. Header should show status: 🟢 online
3. Click Settings → Change status to "Away"
4. Status updates to: 🟡 away
5. Change back to "Online"
6. Status updates to: 🟢 online
```

### Test 5: Visibility API (Auto-Away)

```
1. Login as User A
2. Header shows: 🟢 online
3. Switch to another browser tab (hide this app)
4. Wait 5 seconds (for visibility detection)
5. Switch back to app tab
6. Header shows: 🟡 away (was set automatically when hidden)
7. After 5 more seconds: 🟢 online (was set when visible again)
```

## Phase 4: End-to-End Flow Testing

### Scenario 1: Static App (Leaderboard)

```
1. Click "Leaderboard" tile
   Backend: POST /api/apps/leaderboard/launch
   ✅ App spawned on Unix socket

2. Frontend loads proxy URL
   /api/apps/leaderboard/proxy/
   ✅ Proxy connects to socket
   ✅ Leaderboard app responds

3. App renders in iframe
   ✅ User sees leaderboard data
   ✅ CSS styling works

4. After 10 minutes of inactivity
   ✅ Launcher detects idle timeout
   ✅ Gracefully shuts down app
   ✅ Socket file deleted
```

### Scenario 2: 2-Player Game (Tic-Tac-Toe)

```
1. User A clicks "Tic-Tac-Toe"
   ✅ Game tile selected

2. User A selects opponent (User B)
   Backend: Challenge created

3. User B accepts challenge
   Backend: Game session created
   Backend: User A, User B joined to session

4. Game launches for User A
   POST /api/apps/tic-tac-toe/launch?gameId=xyz
   GET /api/apps/tic-tac-toe/proxy/?gameId=xyz
   ✅ Game loads
   ✅ SessionParticipants shows 2 players

5. User B opens game
   ✅ Game loads
   ✅ Same game state (from database)

6. Moves are made in real-time
   User A moves → Database updated
   User B sees update (if SSE enabled in app)

7. Game ends
   ✅ Both users leave session gracefully
   ✅ Sessions cleanup
```

### Scenario 3: Multi-Player Game (Last Man Standing)

```
1. 6 users send challenge to each other
   Backend: Multi-player session created

2. Game launches for each user
   ✅ 6 separate instances (or shared session)
   ✅ SessionParticipants shows 6 players
   ✅ Ranked by status: active/grace_period/left

3. User 3 disconnects (network drops)
   ✅ Status changes to ⏳ Reconnecting (grace_period)
   ✅ Other players see this

4. User 3 rejoins within 30s
   ✅ Status returns to ✅ In Game
   ✅ Game continues seamlessly

5. User 4 doesn't reconnect (closes browser)
   ✅ After 30s, status changes to ❌ Left
   ✅ Game can proceed (or wait for rejoin)
```

## Monitoring and Debugging

### View Running Apps

```bash
curl http://localhost:3001/api/apps/running | jq

# Output:
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
    },
    {
      "appId": "leaderboard",
      "pid": 12346,
      "status": "running",
      ...
    }
  ],
  "count": 2
}
```

### Check App Logs

```bash
# Backend logs show app lifecycle
tail -f activity-hub-backend.log | grep "tic-tac-toe"

# Expected patterns:
# ✅ Launched app tic-tac-toe (PID xxxxx)
# ⚠️  Health check failed
# 💥 App tic-tac-toe crashed
# ✅ App tic-tac-toe shut down gracefully
```

### Monitor Database Events

```bash
# Watch app lifecycle events
watch -n 1 "psql -U activityhub -d activity_hub -c \"
  SELECT app_id, event_type, COUNT(*) as count, MAX(created_at)
  FROM app_lifecycle_events
  GROUP BY app_id, event_type
  ORDER BY MAX(created_at) DESC;
\""

# Watch awareness events
watch -n 1 "psql -U activityhub -d activity_hub -c \"
  SELECT event_type, COUNT(*) as count, MAX(created_at)
  FROM awareness_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY event_type;
\""
```

### Check Sockets

```bash
# List all activity-hub sockets
ls -la /tmp/activity-hub-*.sock

# Check permissions (should be -rw-rw-rw-)
stat /tmp/activity-hub-tic-tac-toe.sock

# Test connectivity
curl --unix-socket /tmp/activity-hub-tic-tac-toe.sock http://unix/api/health
```

## Performance Baseline

Expected metrics on Pi:

| Metric | Expected |
|--------|----------|
| App launch time | 1-2 seconds |
| First request latency | <100ms |
| Proxy overhead | <10ms |
| Health check latency | <50ms |
| SSE connection time | <500ms |
| Idle app memory | Freed (0 bytes) |
| Running app memory | 20-50MB |

## Rollback Plan

If issues occur:

```bash
# 1. Stop activity-hub backend
systemctl stop activity-hub

# 2. Revert code
git revert <problematic-commit>

# 3. Rebuild
go build

# 4. Remove old sockets
rm /tmp/activity-hub-*.sock

# 5. Restart
systemctl start activity-hub

# 6. Verify
curl http://localhost:3001/api/health
```

## Success Criteria

✅ All tests pass
✅ No database errors
✅ No socket permission issues
✅ Apps launch within 2 seconds
✅ Proxy requests complete within 100ms
✅ Health checks run every 30s
✅ Idle apps shutdown after 10 minutes
✅ Crashed apps auto-restart (max 3 times)
✅ Frontend loads apps without errors
✅ Multiplayer games track participants
✅ Grace period reconnection works
✅ SSE streams functional
✅ Awareness events logged to database

## Next Steps

1. [ ] Deploy to Pi
2. [ ] Run all tests above
3. [ ] Monitor for 24+ hours
4. [ ] Verify cleanup jobs run (daily at midnight)
5. [ ] Stress test with 10+ concurrent users
6. [ ] Integrate with mini-app repos
7. [ ] Update deployment documentation

---

**Status:** Ready for Pi deployment
**Last Updated:** 2026-03-16
**See Also:** [AWARENESS_SERVICE.md](./AWARENESS_SERVICE.md), [MINI_APP_INTEGRATION.md](./MINI_APP_INTEGRATION.md)
