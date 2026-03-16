# Mini-App Integration Guide

## Quick Start: Get Your App Running in 5 Minutes

### Step 1: Add Unix Socket Support to main.go

Find this code:
```go
func main() {
    port := getEnv("PORT", "4001")
    log.Fatal(http.ListenAndServe(":"+port, handler))
}
```

Replace with:
```go
func main() {
    socketPath := os.Getenv("SOCKET_PATH")
    if socketPath != "" {
        // Unix socket mode (production)
        log.Printf("🚀 Starting on Unix socket: %s", socketPath)
        os.Remove(socketPath)  // Clean up old socket
        listener, err := net.Listen("unix", socketPath)
        if err != nil {
            log.Fatal("Failed to create Unix socket:", err)
        }
        os.Chmod(socketPath, 0666)
        log.Fatal(http.Serve(listener, handler))
    } else {
        // TCP mode (development)
        port := getEnv("PORT", "4001")
        log.Printf("🚀 Starting on TCP port: %s", port)
        log.Fatal(http.ListenAndServe(":"+port, handler))
    }
}
```

**Required imports:**
```go
import (
    "net"
    "os"
    // ... existing imports
)
```

That's it! Your app now supports both modes.

### Step 2: Build Binary

```bash
cd games/{app-name}/backend
go build -o {app-name}-app .
mkdir -p ../../../apps/{app-name}/backend
cp {app-name}-app ../../../apps/{app-name}/backend/
cp -r static ../../../apps/{app-name}/backend/ 2>/dev/null || true
```

Or add to build script:
```bash
#!/bin/bash
for app_path in games/*; do
    app_name=$(basename "$app_path")
    cd "$app_path/backend"
    go build -o "$app_name-app" .
    cd -
done
```

### Step 3: Deploy and Test

On Pi:
```bash
# Pull latest code
git pull

# Run migrations to add awareness schema
psql -U activityhub -d activity_hub < database/awareness_schema.sql

# Build apps
./scripts/build_apps.sh

# Restart activity-hub backend
# (it will auto-launch apps on first request)
```

## Backend Integration

### API Endpoint Requirements

Your app MUST have a `/api/health` endpoint:

```go
func handleHealth(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status": "ok",
        "app": "tic-tac-toe",
        "timestamp": time.Now(),
    })
}

// Register in router
router.HandleFunc("/api/health", handleHealth).Methods("GET")
```

The launcher health checks this endpoint every 30 seconds. If it fails 3 times, the app is marked as crashed.

## Frontend Integration

### Single-Player Apps (Utilities)

No changes needed for single-player apps! The proxy handles everything.

**Example:** Leaderboard app

```go
// main.go - just add Unix socket support above
// All existing endpoints work through proxy
```

```typescript
// Frontend automatically uses proxy
// Click tile → Frontend: POST /api/apps/leaderboard/launch
//           → Frontend: GET /api/apps/leaderboard/proxy/
//           → App displays normally
```

### Multiplayer Games

For games with multiplayer, use awareness to show participants.

#### Example: Tic-Tac-Toe 2-Player

**Backend (no changes)** - just add Unix socket support

**Frontend:**

```typescript
import { useSessionAwareness } from '@activity-hub/sdk';
import { SessionParticipants } from '@activity-hub/ui';

interface GameBoardProps {
  gameId: string;
  userId: string;
  userName: string;
}

export function GameBoard({ gameId, userId, userName }: GameBoardProps) {
  // Get app ID from URL or props
  const appId = 'tic-tac-toe';

  // Track session participants
  const { participants } = useSessionAwareness(
    userId,
    userName,
    appId,
    gameId  // Use game ID as session ID
  );

  return (
    <div className="ah-container">
      <h1>Tic-Tac-Toe</h1>

      {/* Show who's playing */}
      <SessionParticipants
        participants={participants}
        currentUserId={userId}
      />

      {/* Game board */}
      <div className="ah-game-board ah-game-board--3x3">
        {board.map(cell => (
          <div key={cell.id} className="ah-game-cell">
            {cell.value}
          </div>
        ))}
      </div>

      {/* Status */}
      <p>
        Turn: {currentPlayer === userId ? 'Your turn' : 'Opponent\'s turn'}
      </p>
    </div>
  );
}
```

**Key points:**
- Use `gameId` as the `sessionId` for awareness
- `useSessionAwareness` auto-joins and auto-leaves
- Component handles grace period automatically
- Show `SessionParticipants` to display players

#### Example: Multi-Player Game (3-6 players)

```typescript
export function GameLobby({ sessionId, userId, userName }) {
  const appId = 'last-man-standing';

  // Track session
  const { participants, isInSession, joinSession, leaveSession } =
    useSessionAwareness(userId, userName, appId, sessionId);

  // Auto-join when component mounts
  // Auto-leave when component unmounts
  // No manual calls needed!

  const readyPlayers = participants.filter(p => p.status === 'active').length;
  const totalPlayers = participants.length;

  return (
    <div>
      <h2>Waiting for players...</h2>

      <SessionParticipants
        participants={participants}
        currentUserId={userId}
      />

      <p>
        Ready: {readyPlayers}/{totalPlayers}
      </p>

      {readyPlayers >= 3 ? (
        <button className="ah-btn-primary">Start Game</button>
      ) : (
        <button className="ah-btn-outline" disabled>
          Waiting for players...
        </button>
      )}
    </div>
  );
}
```

## Testing Checklist

### Unit Tests (Run Locally - TCP Mode)

```bash
# Set TCP port
export PORT=4001

# Build
go build -o app-test .

# Run
./app-test

# Test endpoints
curl http://localhost:4001/api/health
curl http://localhost:4001/api/game
```

### Integration Tests (On Pi - Socket Mode)

```bash
# Compile and place binary
go build -o tic-tac-toe-app .
mkdir -p ../../../apps/tic-tac-toe/backend
cp tic-tac-toe-app ../../../apps/tic-tac-toe/backend/

# Pull latest activity-hub
cd ../../../
git pull

# Request app launch through activity-hub
curl -X POST http://localhost:3001/api/apps/tic-tac-toe/launch

# Verify socket created
ls -la /tmp/activity-hub-tic-tac-toe.sock

# Test health check
curl --unix-socket /tmp/activity-hub-tic-tac-toe.sock http://unix/api/health

# Test proxy
curl http://localhost:3001/api/apps/tic-tac-toe/proxy/api/health

# Verify in database
psql -U activityhub -d activity_hub \
  -c "SELECT * FROM app_lifecycle_events WHERE app_id='tic-tac-toe' LIMIT 5;"
```

## Common Issues

### Socket Connection Refused

**Symptom:** `curl: (7) Couldn't connect to server`

**Solution:**
1. Check socket exists: `ls -la /tmp/activity-hub-{appId}.sock`
2. Check permissions: Should be `-rw-rw-rw-` (0666)
3. Fix in app: `os.Chmod(socketPath, 0666)` after Listen()

### Health Check Failing

**Symptom:** App marked as crashed after 3 checks

**Check:**
1. Endpoint exists: `curl http://localhost:PORT/api/health`
2. Returns 200 status
3. App can connect to databases

### Database Not Found

**Symptom:** App crashes on startup

**Solution:**
1. Check database exists: `psql -l | grep {app_db}`
2. Initialize if needed: `psql -U {user} -d {app_db} < schema.sql`
3. Verify credentials match env vars

### Proxy Returns 502

**Symptom:** App doesn't load, error 502 Bad Gateway

**Check:**
1. App socket exists and is writable
2. App is responsive: `curl --unix-socket /tmp/activity-hub-{appId}.sock http://unix/api/health`
3. Request format is correct

## Best Practices

### Error Handling

```go
// Always return proper errors
if err != nil {
    http.Error(w, "Internal server error", http.StatusInternalServerError)
    log.Printf("Error handling request: %v", err)
    return
}
```

### Logging

```go
// Log startup
log.Printf("🚀 Starting {AppName} on SOCKET_PATH=%s", socketPath)

// Log important events
log.Printf("✅ Game created: %s", gameId)
log.Printf("⚠️  Invalid move from user: %s", userId)
```

### Configuration

```go
// Use environment variables
dbHost := getEnv("DB_HOST", "127.0.0.1")
redisHost := getEnv("REDIS_HOST", "127.0.0.1")

// These are set by launcher automatically
appId := os.Getenv("APP_ID")
socketPath := os.Getenv("SOCKET_PATH")
```

### Graceful Shutdown

```go
// Handle SIGTERM (when launcher shuts down app)
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, syscall.SIGTERM)
go func() {
    <-sigChan
    log.Println("Received SIGTERM, shutting down...")
    // Close connections
    db.Close()
    listener.Close()
    os.Exit(0)
}()
```

## Awareness in Depth

### When to Use Awareness

**DO use awareness:**
- ✅ Multiplayer games (need to show who's playing)
- ✅ Games with SSE (know when players disconnect)
- ✅ Games with session state (prevent ghost players)

**DON'T use awareness:**
- ❌ Single-player games (unnecessary overhead)
- ❌ Utilities (leaderboard, settings, etc.)
- ❌ Games with no multiplayer features

### Session Lifecycle

```typescript
// Game starts - user joins session
const { participants, isInSession } = useSessionAwareness(
  userId, userName, appId, gameId
);
// ↓ Hook auto-calls: POST /api/awareness/sessions/join

// Game plays - show participants
<SessionParticipants participants={participants} />

// Player disconnects (browser closes, wifi drops)
// ↓ 30-second grace period starts
// ↓ Other players see: "Bob is Reconnecting..."

// Player reconnects within 30s
// ↓ ReconnectSession() called automatically
// ↓ Other players see: "Bob is back!"

// Game ends - component unmounts
// ↓ Hook auto-calls: POST /api/awareness/sessions/leave
// ↓ Marks session as left
// ↓ Notifies other players
```

## Support

### Documentation

- [App Launcher Guide](./APP_LAUNCHER.md) - How apps are launched
- [Awareness Service Guide](./AWARENESS_SERVICE.md) - Presence & sessions
- [React Hooks Reference](#) - useAwareness, useSessionAwareness

### Examples

See working implementations:
- Single-player: Sudoku (`games/sudoku/backend`)
- 2-player: Tic-Tac-Toe (`games/tic-tac-toe/backend`)
- Multi-player: Last Man Standing (`games/last-man-standing/backend`)

### Questions

Ask in the activity-hub channel or open an issue on GitHub.

## Checklist for Launch

- [ ] App compiled to binary in `./apps/{appId}/backend/{appId}-app`
- [ ] Main.go supports Unix sockets
- [ ] /api/health endpoint exists
- [ ] App connects to correct database
- [ ] All endpoints work through proxy
- [ ] Multiplayer games use useSessionAwareness (if applicable)
- [ ] Multiplayer games display SessionParticipants component
- [ ] No hardcoded localhost ports (use env vars)
- [ ] Database initialized on Pi
- [ ] Tested on Pi before production

## See Also

- [App Launcher Guide](./APP_LAUNCHER.md)
- [Awareness Service Guide](./AWARENESS_SERVICE.md)
