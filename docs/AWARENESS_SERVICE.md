# Awareness Service: User Presence & Multiplayer Sessions

## Overview

The Awareness Service tracks user presence and manages multiplayer game sessions with:

- **Presence tracking** - Who's online and what they're doing (20s heartbeat, 45s TTL)
- **Status management** - Users set status: online, in_game, away, offline, do_not_disturb
- **Session tracking** - Participants in multiplayer games with grace period reconnection
- **Real-time updates** - SSE streams for presence and session changes
- **Auto-reconnect** - 30-second grace period allows rejoining without losing session

## Architecture

### Client-Side

```
App mounts
    ↓
useAwareness(userId, displayName)
    - Starts 20s heartbeat
    - Connects to presence SSE
    ↓
useSessionAwareness(userId, displayName, appId, sessionId) [games only]
    - Joins session automatically
    - Tracks participants
    - Connects to session SSE
    ↓
Components display real-time data
```

### Backend

```
POST /api/awareness/heartbeat (20s intervals)
    → SetUserAwareness() in Redis (45s TTL)
    → Broadcast presence_update event via SSE
    → Log to PostgreSQL

GET /api/awareness/stream
    → Subscribe to presence updates
    → Receive new users, status changes, offline events

POST /api/awareness/sessions/join
    → JoinGameSession() adds user to session
    → Publish participant_joined event
    → Set user status to in_game

POST /api/awareness/sessions/leave
    → LeaveGameSession() starts grace period (30s)
    → User can reconnect seamlessly if they return
    → After 30s, mark as left
```

## Status Levels

```
Online       🟢  - Available and active
In Game      🎮  - Currently in a game session
Away         🟡  - Not actively using the app (auto-set when tab hidden)
Offline      ⚪  - Not broadcasting heartbeat
Do Not       🔴  - Intentionally unavailable
Disturb
```

## Session Grace Period

When a user disconnects (browser closes, network drops):

```
Timeline:
t=0s        User disconnects
            → Status → grace_period
            → SSE broadcasts participant status change

t=0-30s     Reconnection window (grace period)
            → ReconnectSession() rejoins without re-adding
            → Other players see user as "Reconnecting..."

t=30s       Grace period expires
            → LeaveGameSession() finalizes
            → User marked as left
            → Other players notified

t>30s       User can rejoin normally
            → JoinGameSession() adds as new participant
```

## Frontend Integration

### Initialize Awareness

In Shell or main app component:

```typescript
import { useAwareness } from '@activity-hub/sdk';

function App() {
  const { status, setStatus, isInitialized } = useAwareness(
    user.email,
    user.name
  );

  if (isInitialized) {
    // Awareness ready
    // Status automatically updates
    // Heartbeat running in background
  }

  return (
    <div>
      {/* Display current status */}
      <StatusBadge status={status} />

      {/* Allow user to change status */}
      <StatusSelector
        currentStatus={status}
        onChange={setStatus}
      />
    </div>
  );
}
```

### Multiplayer Game Session

In game component:

```typescript
import { useSessionAwareness } from '@activity-hub/sdk';
import { SessionParticipants } from '@activity-hub/ui';

function GameBoard({ appId, sessionId, userId }) {
  const { participants, isInSession } = useSessionAwareness(
    userId,
    displayName,
    appId,
    sessionId
  );

  if (!isInSession) {
    return <div>Joining session...</div>;
  }

  return (
    <div>
      {/* Show who's playing */}
      <SessionParticipants
        participants={participants}
        currentUserId={userId}
      />

      {/* Game board */}
      <GameBoard participants={participants} />
    </div>
  );
}
```

### Online Users List

```typescript
import { OnlineUsersList, PresenceBadge } from '@activity-hub/ui';

function Lobby() {
  // Get online users from awareness or lobby hook
  const onlineUsers = getOnlineUsers();

  return (
    <div>
      <h2>Online Users ({onlineUsers.length})</h2>
      <OnlineUsersList
        users={onlineUsers}
        showStatus={true}
        showCurrentApp={true}
        onUserClick={(user) => console.log('Clicked:', user)}
      />
    </div>
  );
}
```

## API Endpoints

### Heartbeat

```bash
POST /api/awareness/heartbeat
{
  "userId": "alice@test.com",
  "displayName": "Alice",
  "status": "online",
  "currentApp": "tic-tac-toe",
  "platform": "web"
}

Response: { "success": true, "message": "Heartbeat received" }
```

Sent by client every 20 seconds. Updates:
- User presence in Redis
- Last seen timestamp
- Current status and app

### Change Status

```bash
POST /api/awareness/status
Header: Authorization: Bearer {token}
{
  "status": "away"
}

Response: { "success": true, "status": "away" }
```

### Get Online Users

```bash
GET /api/awareness/users

Response:
{
  "users": [
    {
      "userId": "alice@test.com",
      "displayName": "Alice",
      "status": "in_game",
      "currentApp": "tic-tac-toe",
      "currentSession": "game-123",
      "lastSeen": 1710586200,
      "platform": "web"
    },
    ...
  ],
  "count": 5
}
```

### Presence SSE Stream

```bash
GET /api/awareness/stream

# Browser receives events like:
data: {
  "type": "presence_update",
  "data": { ...UserAwareness },
  "timestamp": 1710586200
}

# Also receives: user_online, user_offline events
```

### Join Session

```bash
POST /api/awareness/sessions/join
Header: Authorization: Bearer {token}
{
  "appId": "tic-tac-toe",
  "sessionId": "game-123"
}

Response: { "success": true, "message": "Joined session" }
```

### Leave Session

```bash
POST /api/awareness/sessions/leave
Header: Authorization: Bearer {token}
{
  "appId": "tic-tac-toe",
  "sessionId": "game-123"
}

Response: { "success": true, "message": "Left session (grace period active)" }
```

### Get Session Participants

```bash
GET /api/awareness/sessions/{appId}/{sessionId}

Response:
{
  "participants": [
    {
      "userId": "alice@test.com",
      "displayName": "Alice",
      "joinedAt": 1710586100,
      "status": "active"
    },
    {
      "userId": "bob@test.com",
      "displayName": "Bob",
      "joinedAt": 1710586150,
      "status": "grace_period"  // Disconnected, can reconnect
    }
  ],
  "count": 2
}
```

### Session SSE Stream

```bash
GET /api/awareness/sessions/stream/{appId}/{sessionId}

# Browser receives:
data: {
  "type": "session_state",
  "data": {
    "participants": [...],
    "count": 2
  },
  "timestamp": 1710586200
}

# Also receives: participant_joined, participant_left, participant_reconnected
```

## React Hooks

### useAwareness

```typescript
const {
  status,              // Current status: online, away, do_not_disturb, etc.
  setStatus,           // Function to change status
  onlineUsers,         // List of online users
  isInitialized        // Whether heartbeat is running
} = useAwareness(userId, displayName);
```

**Behavior:**
- Auto-starts 20s heartbeat
- Connects to presence SSE
- Auto-sets "away" when tab hidden
- Cleans up on unmount

### useSessionAwareness

```typescript
const {
  participants,        // Array of SessionParticipant
  joinSession,         // Function to join session
  leaveSession,        // Function to leave session
  isInSession          // Whether user is in session
} = useSessionAwareness(userId, displayName, appId, sessionId);
```

**Behavior:**
- Auto-joins session on mount (if appId/sessionId provided)
- Subscribes to session updates
- Handles grace period reconnections
- Cleans up on unmount

### useSSE

Generic SSE hook with auto-reconnect:

```typescript
const {
  isConnected,         // Whether connected to SSE
  error,               // Connection error if any
  reconnect            // Manual reconnect function
} = useSSE(url, onEvent, {
  reconnectInterval: 5000,    // 5s between attempts
  maxReconnectAttempts: 5     // Max 5 attempts
});
```

## UI Components

### PresenceBadge

Shows user status emoji and optional label:

```typescript
<PresenceBadge
  status="online"
  size="medium"      // small, medium, large
  showLabel={true}   // Show status text
/>
```

Output: `🟢 Online`

### OnlineUsersList

List of all online users:

```typescript
<OnlineUsersList
  users={users}
  showStatus={true}
  showCurrentApp={true}
  onUserClick={(user) => { ... }}
  emptyMessage="No users online"
/>
```

### SessionParticipants

Show game session participants:

```typescript
<SessionParticipants
  participants={participants}
  currentUserId={userId}
  showGracePeriod={true}   // Show reconnecting players
  maxDisplay={10}          // Limit to first N
/>
```

Displays:
- Active players (✅)
- Reconnecting players (⏳)
- Left players (❌)

### StatusSelector

Let user change status:

```typescript
<StatusSelector
  currentStatus={status}
  onChange={(newStatus) => setStatus(newStatus)}
  disabled={false}
/>
```

## Database

### awareness_events table

```sql
SELECT * FROM awareness_events
WHERE user_id = 'alice@test.com'
ORDER BY created_at DESC
LIMIT 50;

-- Event types:
-- - heartbeat         (sent every 20s)
-- - status_change     (manual status change)
-- - session_join      (joined game)
-- - session_leave     (left game)
-- - reconnect         (rejoined during grace period)
-- - timeout           (grace period expired)
```

Old events (30+ days) are automatically cleaned up daily.

## Best Practices

### For Mini-App Developers

**DO:**
- ✅ Use `useSessionAwareness` hook to track players
- ✅ Display `SessionParticipants` component
- ✅ Handle grace period in UI (show "reconnecting..." state)
- ✅ Clean up on unmount (hook does this automatically)

**DON'T:**
- ❌ Make direct API calls (use hooks instead)
- ❌ Use awareness for single-player games
- ❌ Leave participants in session after game ends
- ❌ Ignore grace period (let users reconnect seamlessly)

### Performance

- Heartbeat every 20s (lightweight)
- SSE streams are long-lived (keep number of open streams low)
- Grace period is short (30s) - don't rely on it for recovery
- Session data stored in Redis (fast access, 1hr TTL)

### Reliability

- Heartbeats include retry logic (browser handles failures)
- SSE auto-reconnects on error (exponential backoff)
- Grace period survives brief network hiccups
- No data loss (Redis persisted to disk)

## Troubleshooting

### Heartbeat Not Sending

Check:
- [ ] Browser console for errors
- [ ] Network tab for POST /api/awareness/heartbeat
- [ ] Token in localStorage

### SSE Connection Not Opening

Check:
- [ ] Browser allows EventSource from this domain
- [ ] CORS headers (should be * for localhost)
- [ ] Network connectivity
- [ ] Check /api/awareness/stream endpoint responds

### Grace Period Not Working

Check:
- [ ] User left session (LeaveGameSession called)
- [ ] User reconnects within 30 seconds
- [ ] Same userId and session
- [ ] Grace period key still exists in Redis

### Participants Not Updating

Check:
- [ ] SSE stream connected (onmessage events firing)
- [ ] Session stream URL correct: `/api/awareness/sessions/stream/{appId}/{sessionId}`
- [ ] Other users in session (need at least 2 to see updates)

## See Also

- [App Launcher Guide](./APP_LAUNCHER.md)
- [Mini-App Integration Guide](./MINI_APP_INTEGRATION.md)
