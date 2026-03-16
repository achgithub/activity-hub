# Identity-Shell → Activity Hub Restructuring Plan

**Date:** 2026-03-16
**Status:** Pre-Implementation Review
**Model:** Sonnet (compact phase)

---

## Executive Summary

Identity-shell is a working platform (~4,900 lines Go + ~2,200 lines React) that matches the production-ready architecture from the PDFs. Restructuring involves:

1. **Rename:** `identity-shell` → `activity-hub` (single monorepo)
2. **Extract:** Shared code into npm packages (`@activity-hub/core`, `@activity-hub/ui`, `@activity-hub/sdk`)
3. **Validate:** Create dummy mini-app (separate repo) to test the import/interface model
4. **Enforce:** Strict TypeScript interfaces for all mini-apps
5. **Publish:** Packages to npm registry for external consumption

---

## Current Architecture

### Backend (Go) - 4,929 lines total
```
identity-shell/backend/
├── main.go (428 lines)           - Server setup, routing, SPA fallback
├── lobby.go (722 lines)          - Presence, challenges (2-player + multi-player), SSE
├── redis.go (488 lines)          - Session/presence caching
├── admin.go (282 lines)          - App enable/disable
├── apps.go (178 lines)           - App registry (loaded from PostgreSQL)
├── impersonation.go (201 lines)  - Super-user testing
├── preferences.go (169 lines)    - User app visibility & ordering
├── apps.json (3.3KB)             - App registry seed data
└── static/                       - Built frontend assets
```

**Key Patterns:**
- HTTP routing via `gorilla/mux`
- PostgreSQL for persistence (users, apps, challenges, preferences)
- Redis for real-time (presence, sessions)
- SSE for lobby streaming
- Bearer token auth (simple demo tokens, should upgrade to JWT)

### Frontend (React) - 2,200+ lines
```
identity-shell/frontend/
├── src/
│   ├── App.tsx (178 lines)       - Main router, auth state, token validation
│   ├── types.ts (114 lines)      - All TypeScript interfaces
│   ├── components/
│   │   ├── Shell.tsx (244 lines)           - Main container, header, routing
│   │   ├── Lobby.tsx (583 lines)           - Online users, challenges, SSE listener
│   │   ├── AppContainer.tsx (105 lines)    - Dynamic iframe/internal app loader
│   │   ├── LoginView.tsx (118 lines)       - Auth entry
│   │   ├── GameChallengeModal.tsx (312)    - 2-player challenge UI
│   │   ├── MultiPlayerChallengeModal.tsx (338) - Multi-player challenge UI
│   │   ├── ChallengesOverlay.tsx (199)     - Challenge notifications
│   │   ├── ChallengeModal.tsx (201)        - Base challenge modal
│   │   ├── ChallengeProgress.tsx (86)      - Game progress tracking
│   │   ├── ChallengeToast.tsx (35)         - Toast notification
│   │   └── Settings.tsx (240)              - User preferences
│   ├── hooks/
│   │   ├── useLobby.ts           - Challenge/presence management
│   │   └── useApps.ts            - App loading, URL building
│   └── index.tsx, App.css
├── package.json (18 deps)
└── tsconfig.json
```

**Key Patterns:**
- React Router for SPA routing
- Custom hooks for API communication
- SSE event listener for real-time updates
- Bearer token in localStorage
- Dynamic iframe loading via `buildAppUrl()`

### Shared Library (lib/activity-hub-common)
```
lib/activity-hub-common/
├── auth/                    - Token validation, types
├── database/                - PostgreSQL connection helpers
├── redis/                   - Redis client initialization
├── sse/                     - Event streaming handlers
├── config/                  - Environment management
└── styles/                  - Shared CSS, tailwind config
```

**Used by:** identity-shell backend only (not published to npm)

---

## Type System (Current)

### Interfaces Defined in `frontend/src/types.ts`

```typescript
export interface User {
  email: string;
  name: string;
  is_admin?: boolean;
  impersonating?: boolean;
  superUser?: string;
  is_guest?: boolean;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  type: 'internal' | 'iframe';
  url?: string;
  description: string;
  category: 'game' | 'utility' | 'admin';
  backendPort?: number;
  realtime?: 'websocket' | 'sse' | 'none';
  minPlayers?: number;
  maxPlayers?: number;
  guestAccessible?: boolean;
  displayOrder?: number;
}

export interface Challenge {
  id: string;
  initiatorId?: string;
  playerIds?: string[];
  accepted?: string[];
  appId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'ready' | 'active';
  createdAt: number;
  expiresAt: number;
}

export interface UserPresence {
  email: string;
  displayName: string;
  status: 'online' | 'in_game' | 'away';
  currentApp?: string;
  lastSeen: number;
}

export interface GameConfig {
  appId: string;
  name: string;
  icon: string;
  description: string;
  gameOptions: GameOption[];
}
```

**Note:** These live in frontend but should be in shared library for mini-apps to import.

---

## App Registry System

**apps.json structure:**
```json
{
  "apps": [
    {
      "id": "tic-tac-toe",
      "name": "Tic-Tac-Toe",
      "icon": "⭕",
      "type": "iframe",
      "url": "http://{host}:4001",
      "backendPort": 4001,
      "realtime": "sse",
      "category": "game"
    }
  ]
}
```

**Currently 12 apps registered:**
- tic-tac-toe (4001)
- dots (4011)
- spoof (4051, multi-player)
- quiz-player (4041)
- quiz-master (5080)
- quiz-display (5081)
- sweepstakes (4031)
- season-scheduler (5040)
- leaderboard (5030)
- mobile-test (4061)
- smoke-test (5010)

---

## API Endpoints

### Public (no auth required)
```
POST   /api/login              - Username + code → token
POST   /api/login/guest        - Generate guest token
POST   /api/validate           - Validate token → user
GET    /api/health             - Health check
GET    /api/apps               - List apps (filtered by user role/guest status)
```

### User (requires auth)
```
GET    /api/user/preferences   - Get app visibility/ordering
PUT    /api/user/preferences   - Update preferences
```

### Lobby (requires auth)
```
GET    /api/lobby/presence     - Get online users
POST   /api/lobby/presence     - Update user status
POST   /api/lobby/presence/remove - Go offline
GET    /api/lobby/challenges   - Get received challenges
GET    /api/lobby/challenges/sent - Get sent challenges
POST   /api/lobby/challenge    - Send 2-player challenge
POST   /api/lobby/challenge/multi - Send multi-player challenge
POST   /api/lobby/challenge/accept - Accept challenge
POST   /api/lobby/challenge/reject - Reject challenge
GET    /api/lobby/stream       - SSE stream for lobby updates
```

### Admin (requires setup_admin role)
```
GET    /api/admin/apps         - Get app management list
PUT    /api/admin/apps/{id}    - Update app metadata
POST   /api/admin/apps/{id}/enable|disable - Toggle app
```

### Impersonation (requires super_user role)
```
POST   /api/admin/impersonate  - Start impersonation session
POST   /api/admin/end-impersonation - End impersonation
```

---

## Database Schema (Assumed)

**Tables referenced in code:**
- `users` (email, name, code_hash, is_admin, roles)
- `applications` (id, name, icon, type, description, category, url, backend_port, realtime, min_players, max_players, required_roles, enabled, display_order, guest_accessible)
- `user_app_preferences` (user_email, app_id, is_hidden, custom_order)
- `challenges` (id, app_id, status, created_at, expires_at, initiator_id, player_ids, accepted)
- `impersonation_sessions` (impersonation_token, super_user_email, impersonated_email, is_active)

---

## Current Dependencies

### Backend (Go 1.25)
```
github.com/go-redis/redis/v8
github.com/google/uuid
github.com/gorilla/handlers
github.com/gorilla/mux
github.com/lib/pq
golang.org/x/crypto
github.com/achgithub/activity-hub-common/auth (local import - needs refactoring)
```

### Frontend (Node 18+)
```
react@18.2.0
react-dom@18.2.0
react-router-dom@6.20.0
react-scripts@5.0.1
typescript@4.9.5
qrcode.react@3.1.0
@types/react@18.2.45
@types/react-dom@18.2.18
@types/node@20.10.0
```

---

## Gaps vs. Production-Ready Standard (from PDFs)

| Aspect | Current | Target | Gap |
|--------|---------|--------|-----|
| **Package Formalization** | Loose in lib/ | `@activity-hub/core`, `@activity-hub/ui`, `@activity-hub/sdk` | Need extraction + npm config |
| **Mini-App Interface** | Loose apps.json | Strict `IActivityHubApp` TypeScript interface | Need enforced contract |
| **Version Locking** | None | Semantic versioning + 12-month deprecation windows | Later phase (v2.0) |
| **Auth Implementation** | Simple demo tokens | JWT-based (consider upgrade) | Current OK for MVP |
| **Testing Structure** | None | Unit → Integration → E2E | Phase 3 |
| **Monorepo Setup** | Poly-repo | Turborepo (or pnpm workspaces) | Need root setup |
| **CI/CD** | Manual (Claude hooks) | GitHub Actions workflows | Phase 3 |
| **Documentation** | CLAUDE.md exists | Architecture + API + Setup guides | Phase 3 |
| **Build System** | CRA + standalone | Coordinated build process | Phase 2 |
| **Deployment** | Untested | Dockerfile + docker-compose | Phase 3 |

---

## Restructuring Strategy

### Phase 1: Extract Shared Libraries (Core Extraction)

**Create monorepo structure:**
```
activity-hub/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── user.ts          (User, AuthResponse, ValidateResponse)
│   │   │   │   ├── app.ts           (AppDefinition, AppRegistry)
│   │   │   │   ├── challenge.ts     (Challenge, ChallengeOptions)
│   │   │   │   ├── presence.ts      (UserPresence, UserStatus)
│   │   │   │   ├── game.ts          (GameConfig, GameOption)
│   │   │   │   └── index.ts         (export all)
│   │   │   ├── interfaces/
│   │   │   │   ├── IActivityHubApp.ts (strict mini-app contract)
│   │   │   │   ├── IAppContainer.ts
│   │   │   │   └── index.ts
│   │   │   ├── api/
│   │   │   │   ├── client.ts        (API communication wrapper)
│   │   │   │   └── constants.ts     (API paths, HTTP methods)
│   │   │   └── index.ts             (export all)
│   │   ├── package.json             (name: @activity-hub/core)
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Modal/
│   │   │   │   │   └── ChallengeModal.tsx
│   │   │   │   ├── Toast/
│   │   │   │   │   └── ChallengeToast.tsx
│   │   │   │   ├── Button/
│   │   │   │   └── index.ts          (export all components)
│   │   │   ├── styles/
│   │   │   │   ├── tailwind.config.js
│   │   │   │   └── activity-hub.css  (move from lib/styles)
│   │   │   └── index.ts
│   │   ├── package.json             (name: @activity-hub/ui)
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── sdk/
│       ├── src/
│       │   ├── hooks/
│       │   │   ├── useLobby.ts
│       │   │   ├── useApps.ts
│       │   │   └── index.ts
│       │   ├── utils/
│       │   │   ├── buildAppUrl.ts
│       │   │   ├── tokenStorage.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json             (name: @activity-hub/sdk)
│       ├── tsconfig.json
│       └── README.md
│
├── backend/
│   ├── cmd/
│   │   └── hub/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   ├── service/
│   │   ├── domain/
│   │   ├── storage/
│   │   └── middleware/
│   ├── go.mod
│   ├── go.sum
│   ├── Dockerfile
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── index.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── package.json (root - workspaces config)
├── pnpm-workspace.yaml (or npm/yarn equivalent)
├── tsconfig.base.json (shared TS config)
├── ARCHITECTURE.md
├── README.md
└── CONTRIBUTING.md
```

**Package dependencies:**
```
packages/core/     - NO dependencies except @types/*
packages/ui/       - depends on @activity-hub/core, react
packages/sdk/      - depends on @activity-hub/core
backend/           - no npm deps (Go only)
frontend/          - depends on @activity-hub/core, @activity-hub/ui, @activity-hub/sdk
```

---

### Phase 2: Create Dummy Mini-App (Separate Repo)

**Repository:** `mini-app-smoke-test/`

```
mini-app-smoke-test/
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── types.ts              (extends @activity-hub/core)
│   └── manifest.json         (app metadata)
├── api/                       (optional: Node.js backend)
│   └── config.ts
├── package.json              (imports @activity-hub/core, @activity-hub/ui)
├── tsconfig.json
├── vite.config.ts            (faster build than CRA)
└── README.md                 (how to install @activity-hub packages)
```

**Test objectives:**
1. Can it install `@activity-hub/core` from npm?
2. Can it import and use types?
3. Does it validate against `IActivityHubApp` interface?
4. Can Activity Hub load it in iframe?
5. Can it access Lobby presence, challenges, etc.?

---

### Phase 3: Enforcement Rules (When Stable)

**ESLint plugin for mini-app developers:**
```
eslint-plugin-activity-hub/
├── rules/
│   ├── no-direct-imports-from-frontend.js
│   ├── must-implement-app-interface.js
│   └── validate-manifest.js
└── index.js
```

**Pre-commit hooks (via husky):**
- Must export default `IActivityHubApp` implementation
- Must have valid `manifest.json`
- Must not import from `/frontend` or `/backend` (only packages)

---

## TypeScript Strict Interface (New)

All mini-apps MUST implement this:

```typescript
// @activity-hub/core
export interface IActivityHubApp {
  // App metadata
  manifest: AppManifest;

  // Lifecycle
  initialize(ctx: AppContext): Promise<void>;
  onMount(ctx: AppContext): Promise<void>;
  onUnmount(): Promise<void>;

  // Rendering
  render(): React.ReactNode;

  // Optional: Game config endpoint (if game)
  getGameConfig?(): GameConfig;
}

export interface AppManifest {
  id: string;
  name: string;
  version: string;                    // Semantic versioning
  requiredActivityHubVersion: string; // e.g., "^1.0.0"
  permissions: string[];              // e.g., ["challenges:read", "presence:read"]
  type: 'game' | 'utility' | 'admin';
}

export interface AppContext {
  user: User;
  api: ApiClient;                     // Typed API calls
  localStorage: Storage;              // Scoped to app
  presence: PresenceClient;
  challenges: ChallengeClient;
}
```

**Every mini-app must:**
```typescript
export default class MyGame implements IActivityHubApp {
  manifest = { ... };
  initialize(ctx) { ... }
  onMount(ctx) { ... }
  onUnmount() { ... }
  render() { ... }
}
```

---

## File Organization Summary

### What Gets Renamed
- `identity-shell/` → `activity-hub/`
- `identity-shell/frontend/` → `activity-hub/frontend/`
- `identity-shell/backend/` → `activity-hub/backend/`

### What Gets Extracted (to packages/)
- `frontend/src/types.ts` → `packages/core/src/types/`
- `frontend/src/components/{Modal,Toast,Button}` → `packages/ui/src/components/`
- `frontend/src/hooks/{useLobby,useApps}` → `packages/sdk/src/hooks/`
- `frontend/src/utils/buildAppUrl` → `packages/sdk/src/utils/`
- `lib/styles/` → `packages/ui/src/styles/`
- `lib/auth/` → `packages/core/src/auth/`

### What Stays in Frontend
- `App.tsx` (main router)
- `Shell.tsx` (portal shell)
- `LoginView.tsx` (login entry)
- `pages/` (route pages)
- `styles/app.css` (app-specific styling)

### What Stays in Backend
- All Go code (no changes in logic)
- Can stay as monorepo root `backend/` or `packages/backend/`

---

## npm Publishing Strategy

**Root package.json workspaces:**
```json
{
  "name": "activity-hub-monorepo",
  "version": "1.0.0",
  "private": false,
  "workspaces": [
    "packages/core",
    "packages/ui",
    "packages/sdk"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "publish": "pnpm publish -r"
  }
}
```

**Each package publishes independently:**
```bash
npm publish @activity-hub/core
npm publish @activity-hub/ui
npm publish @activity-hub/sdk
```

**Mini-apps install via:**
```bash
npm install @activity-hub/core @activity-hub/ui @activity-hub/sdk
```

---

## Next Steps (After Compact)

### Immediate (Step 1)
1. Create folder structure in activity-hub
2. Move/copy files to packages/
3. Write package.json for each package
4. Update imports in frontend/backend
5. Test monorepo build

### Short Term (Step 2)
1. Create dummy mini-app repo
2. Test that it imports from packages
3. Validate interface enforcement
4. Load dummy app in Activity Hub iframe

### Later (Step 3)
1. Set up npm registry account
2. Configure GitHub Actions for auto-publish
3. Write ESLint enforcement rules
4. Create mini-app developer guide

---

## Key Files to Review During Implementation

**Current (identity-shell):**
- `frontend/src/types.ts` - Types to extract
- `frontend/src/components/Shell.tsx` - Portal container
- `frontend/src/hooks/useLobby.ts` - Lobby logic
- `backend/main.go` - Server routing
- `backend/apps.go` - App registry
- `lib/activity-hub-common/` - Already partially extracted

**To Create:**
- `activity-hub/packages/core/package.json`
- `activity-hub/packages/ui/package.json`
- `activity-hub/packages/sdk/package.json`
- `activity-hub/package.json` (root with workspaces)
- `mini-app-smoke-test/package.json`

---

## Gotchas & Considerations

1. **Import Paths:** After extraction, update all relative imports in frontend to use `import from '@activity-hub/core'`
2. **tsconfig.json:** Use `path` aliases in root tsconfig for development convenience
3. **Circular Dependencies:** Core can't import from UI; UI can import from Core
4. **Backend in Monorepo:** Go doesn't use npm, but can be at `activity-hub/backend/` logically
5. **Local Development:** Use `pnpm link` or workspaces for instant hot-reload of package changes
6. **Version Alignment:** All three packages (`core`, `ui`, `sdk`) should always have same version for clarity

---

## Questions Answered

**Q: How do mini-apps get Activity Hub core functionality?**
A: They import `@activity-hub/core` from npm registry. Package provides types + API client for auth, challenges, presence, etc.

**Q: Do mini-apps share CSS styling?**
A: Yes. `@activity-hub/ui` exports shared CSS utilities (`.ah-modal`, `.ah-button`, etc.) that mini-apps can use.

**Q: What if Activity Hub updates and breaks mini-app?**
A: Semantic versioning + lock file in mini-app prevents auto-breaking. With stricter interface enforcement (Phase 3), breaking changes require version bump.

**Q: Can mini-apps be in same repo as Activity Hub?**
A: No. User requirement: mini-apps have separate repos. Activity Hub repo is the shared library + core platform only.

---

## Success Criteria

✅ Phase 1 complete when:
- All three packages (`core`, `ui`, `sdk`) are in monorepo
- Frontend compiles with imports from packages
- Backend still compiles and starts
- No logic changed, only reorganization

✅ Phase 2 complete when:
- Dummy mini-app loads in Activity Hub iframe
- It can call `/api/lobby/presence` and see online users
- It implements `IActivityHubApp` interface
- TypeScript validates no violations

✅ Phase 3 complete when:
- ESLint rules enforce interface compliance
- GitHub Actions auto-publishes packages to npm
- Documentation is current
- Mini-app developer can `npm install @activity-hub/*` and build

---

**Ready to implement after compact + Sonnet switch.**
