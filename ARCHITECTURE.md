# Activity Hub Architecture - Memory Joggers

**Purpose**: Quick reference for recurring patterns when building/migrating mini-apps

**Last Updated**: 2026-03-26

---

## 1. Single Sign-On (SSO) Flow

### How Authentication Works

- **Main Platform**: Stores JWT in `localStorage.getItem('token')` after login
  - Login endpoint: `POST /api/login` returns JWT
  - Token validated on startup: `POST /api/validate`

- **Token Passed to Mini-Apps**: Via URL query parameter when iframe loads
  - Pattern: `/api/apps/{appId}/proxy/?token=xxx&userId=xxx&gameId=xxx`

- **Mini-Apps Extract Token**: SDK's `useActivityHubContext` hook
  - Checks localStorage FIRST (standalone mode)
  - Falls back to URL params (iframe mode)

- **Token Validation**: Backend `/api/validate` endpoint
  - Input: `{ token: string }`
  - Output: `{ valid: bool, user: {...}, roles: [...] }`

- **Centralized Auth**: `github.com/achgithub/activity-hub-auth` package
  - JWT generation
  - Token validation
  - Role resolution

### Key Flow

```
User Login → JWT in localStorage → URL param to iframe → Mini-app localStorage → SDK validates
```

**Files**:
- `frontend/src/App.tsx` - Token validation on startup
- `frontend/src/hooks/useApps.ts` - Token added to proxy URL
- `sdk/src/useActivityHubContext.ts` - Token extraction in mini-apps
- `backend/main.go` - Validation endpoint

---

## 2. SDK Integration

### What the SDK Provides

**Core Exports** (`sdk/src/index.ts`):
```tsx
import {
  useActivityHubContext,    // User + roles + email
  useAwareness,              // Real-time presence
  useSessionAwareness,       // Session-specific presence
  requestSSEToken,           // Secure SSE tokens
  createSecureEventSource,   // EventSource helper
} from '@activity-hub/sdk';
```

**Note**: Mini-apps use the SDK for authentication and awareness. UI components (buttons, cards) come from the shared CSS classes in `activity-hub.css`.

### Role Checking Patterns

```tsx
const { roles, user } = useActivityHubContext();

// Check app-specific role (e.g., "tic-tac-toe:admin")
if (roles.hasApp('admin')) {
  // Show admin panel
}

// Check exact Activity Hub role
if (roles.has('ah_g_super')) {
  // Super user actions
}

// Check if user has any role from list
if (roles.hasAny(['ah_r_app_register', 'ah_g_admin'])) {
  // Allow app registration
}

// Check if user has all roles
if (roles.hasAll(['chess:player', 'chess:rated'])) {
  // Allow rated game
}

// Check Activity Hub admin status
if (roles.isAdmin) {
  // Show platform admin features
}
```

### Context Endpoint

- **URL**: `GET /api/user/context`
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "user": { "email": "...", "name": "..." },
    "roles": ["ah_g_admin", "chess:player", "tic-tac-toe:player"],
    "isTestMode": false
  }
  ```

**Role Naming Convention**: `appid:rolename` (e.g., `lms-manager:setup`, `tictactoe:player`)
- See **DATABASE_SUMMARY.md** for role definitions

**Files**:
- `sdk/src/index.ts` - Exports
- `sdk/src/useActivityHubContext.ts` - Context hook implementation
- `backend/main.go` - Context endpoint registration

---

## 3. Common Look & Feel (CSS)

### Single CSS Enforcement

- **Source**: `frontend/src/styles/activity-hub.css` (1,538 lines)
- **Used by**: Activity Hub platform and all mini-apps
- **Git hook**: Enforces no inline styles, no component CSS files

### How to Use Shared CSS

1. Import SDK in mini-app: `import { useActivityHubContext } from '@activity-hub/sdk'`
2. All `.ah-*` classes are immediately available
3. Reference: `frontend/docs/CSS_GUIDE.md` for complete class list

### Class Naming Convention

All classes prefixed with `.ah-*`:

**Layout**:
- `.ah-container`, `.ah-container--wide`, `.ah-container--narrow`
- `.ah-flex-center`, `.ah-flex-between`, `.ah-flex-col`

**Buttons**:
- `.ah-btn-primary`, `.ah-btn-outline`, `.ah-btn-danger`
- `.ah-btn-back`, `.ah-btn-sm`

**Forms**:
- `.ah-input`, `.ah-select`, `.ah-select-fixed`

**Game Boards**:
- `.ah-game-board`, `.ah-game-board--3x3`, `.ah-game-board--4x4`
- `.ah-game-cell`, `.ah-game-cell.active`

**Status**:
- `.ah-badge--success`, `.ah-badge--error`, `.ah-badge--warning`
- `.ah-status--active`, `.ah-status-dot--online`

**Reference**: `frontend/docs/CSS_GUIDE.md` (full class list)

### Enforcement

**Pre-commit hook** (`.githooks/pre-commit`):
- ❌ Blocks component-specific CSS files
- ❌ Blocks CSS imports in components
- ❌ Blocks inline styles
- ⚠️ Warns about hardcoded colors
- ✅ Only allows CSS import in `index.tsx`

**Files**:
- `frontend/src/styles/activity-hub.css` - Single CSS source
- `.githooks/pre-commit` - Enforcement hook

---

## 4. iframe Embedding

### The Embedding Flow

**User Journey**:
1. User clicks app in lobby → Navigate to `/app/:appId`
2. `AppContainer` component mounts
3. Calls `launchApp(appId, gameId)` to wake up backend service
4. Builds iframe URL using proxy path + user context
5. iframe loads mini-app with token in URL
6. Mini-app renders inside iframe sandbox

### Code Flow

**AppContainer.tsx**:
```tsx
// 1. Launch app (POST /api/apps/{appId}/launch)
useEffect(() => {
  launchApp(appId, gameId);  // Line 31
}, [appId, gameId]);

// 2. Build proxy URL with user context
const iframeUrl = buildAppUrl(app, {
  userId: user.email,
  userName: user.name,
  isAdmin: user.is_admin,
  gameId,
});  // Lines 70-76

// 3. Render iframe
<iframe
  src={iframeUrl}  // /api/apps/{appId}/proxy/?token=xxx&userId=xxx
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
/>
```

### Close App Pattern

Mini-apps can close themselves:

```tsx
// In mini-app code
window.parent.postMessage({ type: 'CLOSE_APP' }, '*');
```

Platform listens and navigates back to lobby:

```tsx
// AppContainer.tsx
window.addEventListener('message', (event) => {
  if (event.data?.type === 'CLOSE_APP') {
    navigate('/lobby');
  }
});
```

### Sandbox Security

iframe sandbox attribute: `allow-same-origin allow-scripts allow-forms allow-popups`

- `allow-same-origin`: Access localStorage, cookies (needed for token)
- `allow-scripts`: Run JavaScript
- `allow-forms`: Submit forms
- `allow-popups`: Open new windows (e.g., OAuth flows)

**Files**:
- `frontend/src/components/AppContainer.tsx` - iframe container
- `frontend/src/hooks/useApps.ts` - App launch + URL building

---

## 5. Unix Socket + Proxy Architecture

### Why Unix Sockets?

- **Isolation**: Each mini-app is a separate process
- **Security**: No exposed TCP ports, communication via filesystem
- **Lifecycle**: Backend manages start/stop/health/idle shutdown
- **Simplicity**: Mini-apps just listen on socket, no port conflicts

### Socket Lifecycle

**Startup** (`launcher.go`):
1. Check if app already running → return if yes
2. Load app definition from database registry
3. Build socket path: `/tmp/activity-hub-{appId}.sock`
4. Remove old socket file if exists
5. Launch binary with env vars:
   ```bash
   APP_ID=tic-tac-toe
   SOCKET_PATH=/tmp/activity-hub-tic-tac-toe.sock
   STATIC_PATH=/home/pi/tic-tac-toe/build
   DB_HOST=127.0.0.1
   REDIS_HOST=127.0.0.1
   GAME_ID=abc123  # Optional, for per-game processes
   ```
6. Wait for socket file to appear (10s timeout)
7. Mark as "running"

**Health Monitoring** (`launcher.go`):
- Every 30 seconds: `GET http://unix/api/health`
- 3 failures → mark as crashed
- Auto-restart (max 3 attempts)
- After 3 restarts → give up, kill process

**Idle Shutdown** (`launcher.go`):
- Track last activity timestamp on each proxy request
- Every 5 minutes: check idle duration
- If idle > 10 minutes → graceful shutdown (SIGTERM)
- Force kill after 30s if not responsive
- Remove socket file

### Proxy Request Flow

**Client makes request**:
```
GET /api/apps/tic-tac-toe/proxy/api/game/status?gameId=abc123&token=xxx
```

**Backend proxy handler** (`launcher_handlers.go`):
1. Extract `appId` from URL path → `tic-tac-toe`
2. Get socket path (launches if needed) → `/tmp/activity-hub-tic-tac-toe.sock`
3. Create HTTP client with Unix socket transport:
   ```go
   client := &http.Client{
     Transport: &http.Transport{
       DialContext: func(ctx, network, addr string) (net.Conn, error) {
         return net.Dial("unix", socketPath)
       },
     },
   }
   ```
4. Forward request to: `http://unix/api/game/status?gameId=abc123&token=xxx`
5. Stream response back to client
6. Update `LastActivity` timestamp

**Special handling for SSE**:
- Detect `Content-Type: text/event-stream`
- Stream with flushing after each chunk
- No timeout (allows long-lived connections)

### Mini-App Server Pattern

**Example mini-app setup** (pseudo-code):
```go
func main() {
  socketPath := os.Getenv("SOCKET_PATH")  // /tmp/activity-hub-tic-tac-toe.sock
  staticPath := os.Getenv("STATIC_PATH")  // /home/pi/tic-tac-toe/build
  appID := os.Getenv("APP_ID")            // tic-tac-toe

  // Create router
  r := mux.NewRouter()

  // Health check (REQUIRED)
  r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
  })

  // Serve static files (React build)
  r.PathPrefix("/").Handler(http.FileServer(http.Dir(staticPath)))

  // Listen on Unix socket
  listener, _ := net.Listen("unix", socketPath)
  http.Serve(listener, r)
}
```

**Key Requirements**:
1. ✅ Read `SOCKET_PATH` env var
2. ✅ Listen on Unix socket (not TCP port)
3. ✅ Implement `GET /api/health` returning 200
4. ✅ Serve static files at root path `/`
5. ✅ API routes should be under `/api/*`

### Socket Paths

**Pattern**: `/tmp/activity-hub-{appId}.sock`

**Examples**:
- `/tmp/activity-hub-tic-tac-toe.sock`
- `/tmp/activity-hub-dots.sock`
- `/tmp/activity-hub-chess.sock`

**Cleanup**:
- Auto-removed on graceful shutdown
- Removed before launch (handles crashed processes)
- Not shared between processes (per-app isolation)

**Files**:
- `backend/launcher.go` - Process lifecycle manager
- `backend/launcher_handlers.go` - HTTP proxy implementation
- `backend/main.go:131-139` - Launcher endpoint registration

---

## 6. App Registration

### Database-Driven Registry

**Source**: `applications` table in PostgreSQL

**Key Fields**:
```sql
CREATE TABLE applications (
  id TEXT PRIMARY KEY,              -- e.g., "tic-tac-toe"
  name TEXT NOT NULL,               -- e.g., "Tic-Tac-Toe"
  icon TEXT,                        -- e.g., "❌"
  type TEXT NOT NULL,               -- "iframe" or "internal"
  description TEXT,
  category TEXT,                    -- "game", "utility", "admin"

  -- Unix socket apps (modern)
  binary_path TEXT,                 -- e.g., "../tic-tac-toe/backend/tic-tac-toe"
  static_path TEXT,                 -- e.g., "../tic-tac-toe/frontend/build"

  -- TCP apps (legacy, deprecated)
  backend_port INTEGER,
  url TEXT,

  -- Access control
  required_roles TEXT[],            -- e.g., {"ah_g_admin", "chess:player"}
  guest_accessible BOOLEAN,         -- Allow guest users

  -- Display
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);
```

### Loading Apps

**On Backend Startup** (`apps.go`):
```go
func LoadAppRegistry() error {
  rows, _ := db.Query(`
    SELECT id, name, icon, type, binary_path, static_path,
           required_roles, guest_accessible, enabled, display_order
    FROM applications
    WHERE enabled = TRUE
    ORDER BY display_order, name
  `)

  // Load into memory: appRegistry.Apps = [...]
}
```

### Filtering by User Roles

**GET /api/apps endpoint** (`main.go`):
1. Extract user from Authorization header (optional)
2. Get user's roles from JWT
3. Filter apps where:
   - User has ANY of the `required_roles`, OR
   - App is `guest_accessible` and user is guest, OR
   - App has no `required_roles` (public)
4. Apply user preferences (hidden apps, custom order)
5. Return filtered list

**Role Matching Logic**:
```go
func userHasAccess(userRoles []string, requiredRoles []string) bool {
  if len(requiredRoles) == 0 {
    return true  // No requirements = public access
  }

  for _, userRole := range userRoles {
    for _, requiredRole := range requiredRoles {
      if userRole == requiredRole {
        return true
      }
    }
  }

  return false
}
```

### Two App Patterns

**1. Unix Socket Apps (Modern)**:
```json
{
  "id": "tic-tac-toe",
  "type": "iframe",
  "binary_path": "../tic-tac-toe/backend/tic-tac-toe",
  "static_path": "../tic-tac-toe/frontend/build",
  "required_roles": ["tic-tac-toe:player"]
}
```

**2. TCP Apps (Legacy)**:
```json
{
  "id": "old-game",
  "type": "iframe",
  "url": "http://localhost:4001",
  "backend_port": 4001,
  "required_roles": []
}
```

**Modern pattern is preferred** - uses Unix sockets for better isolation and lifecycle management.

**Files**:
- `backend/apps.go` - Registry loading
- `backend/main.go` - GET /api/apps endpoint
- `database/init.sql` - Table schema (applications table)

---

## 7. SSE Security (Short-Lived Tokens)

### The Problem

EventSource URLs are visible in:
- Browser DevTools Network tab
- Browser history
- Proxy logs

Putting long-lived JWT tokens in SSE URLs = **security risk**.

### The Solution

**Two-token system**:
1. **Main JWT**: Long-lived (days), stored in localStorage, used for API calls
2. **SSE Token**: Short-lived (5 minutes), single-use, used only for EventSource

### Request Flow

**Mini-app requests SSE token**:
```tsx
import { requestSSEToken } from '@activity-hub/sdk';

const sseToken = await requestSSEToken('tic-tac-toe', gameId);
// sseToken expires in 5 minutes
```

**Backend generates SSE token** (`main.go`):
```
POST /api/sse-token
Authorization: Bearer {long-lived-jwt}
{
  "appId": "tic-tac-toe",
  "gameId": "abc123"
}

→ Response:
{
  "success": true,
  "sseToken": "eyJhbGc...",  // 5-minute token
  "expiresIn": 300
}
```

**Mini-app creates EventSource**:
```tsx
const es = new EventSource(`/api/apps/tic-tac-toe/proxy/api/stream?token=${sseToken}`);
```

### Helper Function

SDK provides helper to combine both steps:

```tsx
import { createSecureEventSource } from '@activity-hub/sdk';

const es = await createSecureEventSource(
  '/api/apps/tic-tac-toe/proxy/api/stream',
  'tic-tac-toe',  // appId
  'abc123'        // gameId
);

es.onmessage = (event) => {
  // Handle events
};
```

### Token Claims

**Main JWT Claims**:
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "is_admin": false,
  "roles": ["tic-tac-toe:player", "chess:admin"],
  "exp": 1648512000  // Days from now
}
```

**SSE Token Claims**:
```json
{
  "email": "user@example.com",
  "app_id": "tic-tac-toe",
  "game_id": "abc123",
  "exp": 1648512300  // 5 minutes from now
}
```

**Validation**:
- Mini-app backend validates SSE token
- Checks expiration
- Checks appId matches
- Returns user context

**Files**:
- `sdk/src/sseToken.ts` - Client-side helpers
- `backend/main.go` - SSE token generation endpoint
- `github.com/achgithub/activity-hub-auth` - JWT signing/validation

---

## Recurring Migration Issues - Checklist

When building/migrating a mini-app, verify these in order:

### Phase 1: Authentication
- [ ] Mini-app extracts token from URL query parameter
- [ ] Stores token in localStorage for subsequent requests
- [ ] SDK `useActivityHubContext` hook called to get user + roles
- [ ] Role-based UI rendering works (admin panels, etc.)

### Phase 2: Styling
- [ ] Import SDK in main entry point (`import { ... } from '@activity-hub/sdk'`)
- [ ] Verify shared CSS auto-loads (check Network tab for `activity-hub.css`)
- [ ] All components use `.ah-*` classes only
- [ ] NO inline styles (`style={{ ... }}`)
- [ ] NO component-specific CSS files
- [ ] Git hook passes (`git commit` succeeds)

### Phase 3: Unix Socket Setup
- [ ] Binary reads `SOCKET_PATH` env var
- [ ] Binary creates Unix socket listener (not TCP port)
- [ ] Health endpoint implemented: `GET /api/health` returns `{"status":"ok"}`
- [ ] Static files served at root path `/`
- [ ] API routes under `/api/*`

### Phase 4: App Registration
- [ ] Database entry in `applications` table
- [ ] `binary_path` points to compiled binary (absolute or relative from backend dir)
- [ ] `static_path` points to React build folder
- [ ] `required_roles` set correctly (or empty array for public)
- [ ] `guest_accessible` set if guests should access
- [ ] `enabled = TRUE`
- [ ] Backend logs show "Loaded N apps from database" on startup

### Phase 5: Proxy Integration
- [ ] All API calls from mini-app frontend go to `/api/apps/{appId}/proxy/...`
- [ ] Token passed in query string or Authorization header
- [ ] Backend proxy forwards requests to Unix socket
- [ ] Responses stream correctly (including SSE)
- [ ] No direct TCP connections from frontend

### Phase 6: SSE Streams (if applicable)
- [ ] Use `requestSSEToken()` instead of main JWT
- [ ] EventSource URL includes short-lived SSE token
- [ ] Backend validates SSE token (5-minute expiration)
- [ ] Reconnection logic handles token refresh

### Phase 7: Lifecycle
- [ ] App launches via `POST /api/apps/{appId}/launch`
- [ ] Socket file appears in `/tmp/activity-hub-{appId}.sock`
- [ ] Health checks pass (visible in backend logs every 30s)
- [ ] App shuts down after 10 minutes idle
- [ ] App auto-restarts on crash (up to 3 times)

### Phase 8: User Experience
- [ ] App appears in lobby (filtered by user roles)
- [ ] Clicking app shows loading state while launching
- [ ] iframe loads with user context in URL
- [ ] Close button or `postMessage({ type: 'CLOSE_APP' })` returns to lobby
- [ ] No console errors in browser DevTools

### Phase 9: Debugging
- [ ] Check backend logs: `tail -f backend/logs/activity-hub.log`
- [ ] Check socket exists: `ls -la /tmp/activity-hub-*.sock`
- [ ] Check process running: `ps aux | grep tic-tac-toe`
- [ ] Check health: `curl --unix-socket /tmp/activity-hub-tic-tac-toe.sock http://unix/api/health`
- [ ] Check proxy: Visit `/api/apps/tic-tac-toe/proxy/` in browser

---

## Quick Reference: File Locations

### Frontend (Main Platform)
```
frontend/
├── src/
│   ├── App.tsx                    # Login, token validation, routing
│   ├── components/
│   │   ├── AppContainer.tsx       # iframe embedding
│   │   └── Shell.tsx              # Main shell after login
│   ├── hooks/
│   │   └── useApps.ts             # App launching, proxy URL building
│   └── styles/
│       └── activity-hub.css       # Single CSS source (1,538 lines)
└── docs/
    └── CSS_GUIDE.md               # Complete class reference
```

### SDK
```
sdk/
├── src/
│   ├── index.ts                   # Exports
│   ├── useActivityHubContext.ts   # User + roles hook
│   ├── useAwareness.ts            # Presence hooks
│   ├── sseToken.ts                # SSE token helpers
│   ├── styles/
│   │   └── loadSharedCSS.ts       # Auto-inject CSS
│   └── types/                     # TypeScript definitions
└── package.json
```

### Backend
```
backend/
├── main.go                        # Entry point, routes
├── launcher.go                    # Process lifecycle manager
├── launcher_handlers.go           # HTTP → Unix socket proxy
├── apps.go                        # App registry loading
├── roles_handlers.go              # User context endpoint
└── awareness_handlers.go          # Presence/SSE endpoints
```

### Database
```
database/
└── init.sql                       # Complete schema (applications, roles, user_roles)
```

---

## Environment Variables

### Backend (Activity Hub)
```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=activityhub
DB_PASS=pubgames
DB_NAME=activity_hub
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Mini-App (Launched by Launcher)
```bash
APP_ID=tic-tac-toe
SOCKET_PATH=/tmp/activity-hub-tic-tac-toe.sock
STATIC_PATH=/home/pi/tic-tac-toe/frontend/build
ACTIVITY_HUB_URL=http://localhost:3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=activityhub
DB_PASS=pubgames
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GAME_ID=abc123  # Optional, for per-game processes
```

---

## Common Debugging Commands

### Check Running Apps
```bash
# Backend API
curl http://localhost:3001/api/apps/running

# Socket files
ls -la /tmp/activity-hub-*.sock

# Processes
ps aux | grep activity-hub
```

### Test Unix Socket
```bash
# Health check
curl --unix-socket /tmp/activity-hub-tic-tac-toe.sock \
  http://unix/api/health

# API endpoint
curl --unix-socket /tmp/activity-hub-tic-tac-toe.sock \
  "http://unix/api/game/status?token=xxx"
```

### Monitor Logs
```bash
# Backend logs
tail -f backend/logs/activity-hub.log

# Mini-app logs (if process manager captures them)
tail -f /tmp/activity-hub-tic-tac-toe.log
```

### Database Queries
```sql
-- List all apps
SELECT id, name, enabled, binary_path FROM applications;

-- List user roles
SELECT email, roles FROM users WHERE email = 'user@example.com';

-- Check app access
SELECT * FROM applications WHERE 'tic-tac-toe:player' = ANY(required_roles);
```

---

## Anti-Patterns to Avoid

### ❌ DON'T: Hardcode Hostnames/Ports
```tsx
// BAD
const API_URL = 'http://192.168.1.100:3001';

// GOOD
const API_URL = `http://${window.location.hostname}:3001`;
```

### ❌ DON'T: Use Inline Styles
```tsx
// BAD
<button style={{ background: '#2196F3', padding: '10px' }}>Click</button>

// GOOD
<button className="ah-btn-primary">Click</button>
```

### ❌ DON'T: Create Component CSS Files
```tsx
// BAD
import './MyComponent.css';

// GOOD
// Just use .ah-* classes, no import needed
```

### ❌ DON'T: Use Main JWT in EventSource
```tsx
// BAD
const es = new EventSource(`/stream?token=${localStorage.getItem('token')}`);

// GOOD
const sseToken = await requestSSEToken('app-id', 'game-id');
const es = new EventSource(`/stream?token=${sseToken}`);
```

### ❌ DON'T: Listen on TCP Port in Mini-App
```go
// BAD
http.ListenAndServe(":4001", handler)

// GOOD
socketPath := os.Getenv("SOCKET_PATH")
listener, _ := net.Listen("unix", socketPath)
http.Serve(listener, handler)
```

### ❌ DON'T: Skip Health Endpoint
```go
// BAD
// No /api/health endpoint

// GOOD
r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
  json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
})
```

---

**End of Architecture Guide**

For project-specific conventions, see `CLAUDE.md`.
For CSS class reference, see `frontend/docs/CSS_GUIDE.md`.
