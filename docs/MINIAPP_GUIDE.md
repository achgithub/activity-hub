# Activity Hub Mini-App Development Guide

**Last Updated:** 2026-03-23
**Standard:** Vite + React + TypeScript + activity-hub-sdk

---

## Overview

This guide documents the standard architecture, tooling, and best practices for developing mini-apps on the Activity Hub platform. All mini-apps follow a consistent structure to ensure maintainability and developer experience.

---

## Technology Stack

### Required

- **React 18.2+** - UI framework
- **TypeScript 5.3+** - Type safety
- **Vite 5.0+** - Build tooling (replaces Create React App)
- **activity-hub-sdk ^1.1.1** - Platform integration

### Optional

- **react-router-dom** - Client-side routing (if multi-page)
- **tailwindcss** - Utility CSS (optional, Activity Hub CSS preferred)

---

## Project Structure

```
activity-hub-{appname}/
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── styles/          # App-specific CSS
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx          # Main app component
│   │   └── index.tsx        # Entry point
│   ├── build/               # Production build output
│   ├── index.html           # Root HTML (Vite pattern)
│   ├── vite.config.ts       # Vite configuration
│   ├── tsconfig.json        # TypeScript config
│   └── package.json         # Dependencies
├── backend/
│   ├── main.go              # Go backend server
│   ├── handlers.go          # HTTP handlers
│   └── go.mod
└── README.md
```

---

## Getting Started

### 1. Create Package.json

```json
{
  "name": "activity-hub-{appname}",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "activity-hub-sdk": "^1.1.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### 2. Create vite.config.ts

**CRITICAL:** Set the correct `base` path for your app.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/api/apps/{your-app-name}/proxy/',  // ← CHANGE THIS
  build: {
    outDir: 'build',
  },
})
```

**Why `base` matters:**
- Activity Hub proxies mini-apps at `/api/apps/{app-id}/proxy/`
- Vite needs to know this path to generate correct asset URLs
- Without this, CSS/JS won't load in production

### 3. Create index.html

Place in **frontend root** (not `public/`):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your App Name - Activity Hub</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

### 4. Create src/index.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
// Activity Hub CSS is auto-loaded by SDK
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5. Create src/App.tsx

```tsx
import React from 'react';
import { AppHeader, useActivityHubContext } from 'activity-hub-sdk';

function App() {
  const { user, token } = useActivityHubContext();

  return (
    <div className="ah-container">
      <AppHeader
        title="Your App Name"
        onBack={() => window.location.href = '/'}
      />

      <main>
        <h1>Welcome, {user?.name}!</h1>
        {/* Your app content */}
      </main>
    </div>
  );
}

export default App;
```

---

## Using Activity Hub SDK

### Authentication Context

```tsx
import { useActivityHubContext } from 'activity-hub-sdk';

function MyComponent() {
  const { user, token, isLoading } = useActivityHubContext();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return <div>Hello, {user.name}!</div>;
}
```

### Session Awareness (Multiplayer)

```tsx
import { useSessionAwareness } from 'activity-hub-sdk';

function GameComponent({ gameId }: { gameId: string }) {
  const { user } = useActivityHubContext();

  const { participants, isInSession } = useSessionAwareness(
    user?.email || '',
    user?.name || '',
    'your-app-id',
    gameId
  );

  return (
    <div>
      <h2>Players in game:</h2>
      <ul>
        {participants.map(p => (
          <li key={p.userId}>{p.displayName}</li>
        ))}
      </ul>
    </div>
  );
}
```

### UI Components

```tsx
import { AppHeader, GameCard } from 'activity-hub-sdk';

// AppHeader - Standard header with back button
<AppHeader
  title="My Game"
  onBack={() => window.location.href = '/'}
/>

// GameCard - Styled card container
<GameCard title="Game Stats">
  <p>Your content here</p>
</GameCard>
```

### Server-Sent Events (SSE)

```tsx
import { useSSE } from 'activity-hub-sdk';

function GameComponent({ gameId }: { gameId: string }) {
  const API_BASE = `http://${window.location.hostname}:3001/api`;

  const { isConnected, error } = useSSE(
    `${API_BASE}/game/${gameId}/stream`,
    (event) => {
      console.log('Game event:', event);
      // Handle game state updates
    },
    {
      appId: 'your-app-id',
      gameId: gameId,
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
    }
  );

  return <div>Connected: {isConnected ? '✅' : '❌'}</div>;
}
```

---

## Styling with Activity Hub CSS

The SDK automatically loads the shared Activity Hub CSS. **Do NOT create component-specific CSS files.**

### Available Classes

```tsx
// Layout
<div className="ah-container">         {/* Max-width container */}
<div className="ah-flex-between">      {/* Flex with space-between */}
<div className="ah-flex-center">       {/* Centered flex */}

// Buttons
<button className="ah-btn-primary">     {/* Primary action */}
<button className="ah-btn-outline">     {/* Secondary action */}
<button className="ah-btn-danger">      {/* Destructive action */}

// Forms
<input className="ah-input" />          {/* Text input */}
<select className="ah-select">          {/* Dropdown */}

// Cards
<div className="ah-card">               {/* Card container */}

// Game Boards
<div className="ah-game-board ah-game-board--3x3">  {/* 3x3 grid */}
  <div className="ah-game-cell">                    {/* Game cell */}
    ...
  </div>
</div>

// Status
<span className="ah-badge--success">    {/* Green badge */}
<span className="ah-status--active">     {/* Active indicator */}
```

**See:** `frontend/docs/CSS_GUIDE.md` for complete reference (180+ classes)

---

## Development Workflow

### Local Development

```bash
cd frontend
npm install
npm run dev
```

Vite dev server runs on `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Output: `frontend/build/` directory

### Testing Production Build

```bash
npm run preview
```

Serves the production build locally

---

## Integration with Activity Hub

### 1. Backend (Go) Setup

Your Go backend must:
- Use `github.com/achgithub/activity-hub-auth` for authentication
- Listen on a Unix socket (not TCP port)
- Validate JWT tokens on API requests

```go
import (
    "github.com/achgithub/activity-hub-auth"
)

// Protect API routes
router.Use(auth.AuthMiddleware(identityDB))

// SSE routes need special middleware
router.HandleFunc("/stream", auth.SSEMiddleware(identityDB)(streamHandler))
```

### 2. Unix Socket Configuration

In your `main.go`:

```go
socketPath := "/tmp/your-app-name.sock"
os.Remove(socketPath) // Clean up old socket

listener, err := net.Listen("unix", socketPath)
if err != nil {
    log.Fatalf("Failed to listen on Unix socket: %v", err)
}

log.Printf("🚀 Server listening on Unix socket: %s", socketPath)
http.Serve(listener, router)
```

### 3. Register with Activity Hub

Activity Hub needs to know:
- App ID (e.g., `tic-tac-toe`)
- Display name
- Socket path (`/tmp/your-app.sock`)
- Static file path (`/path/to/frontend/build`)

This is configured in Activity Hub's database.

---

## Best Practices

### Do's ✅

- **Use activity-hub-sdk hooks** for auth, awareness, SSE
- **Use Activity Hub CSS classes** (`.ah-*`) for consistent styling
- **Use TypeScript** for type safety
- **Handle loading/error states** in components
- **Test with JWT authentication** (not just demo tokens)
- **Use semantic HTML** and proper accessibility

### Don'ts ❌

- **Don't create component-specific CSS files** - Use shared classes
- **Don't use inline styles** - Use Activity Hub classes
- **Don't hardcode colors/spacing** - Use design system
- **Don't assume user is authenticated** - Check `isLoading` and `user`
- **Don't use localStorage for auth** - SDK handles it
- **Don't create `.js` or `.jsx` files** - TypeScript only

---

## Common Patterns

### Game State Management

```tsx
const [gameState, setGameState] = useState<GameState>({
  status: 'waiting',
  players: [],
  currentTurn: null,
});

// Update from SSE
useSSE(streamUrl, (event: GameEvent) => {
  if (event.type === 'state_update') {
    setGameState(event.data);
  }
}, { appId, gameId });
```

### API Calls with Auth

```tsx
const { token } = useActivityHubContext();

async function makeMove(move: Move) {
  const response = await fetch(`${API_BASE}/game/${gameId}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(move),
  });

  if (!response.ok) {
    throw new Error('Move failed');
  }

  return response.json();
}
```

### Error Boundaries

```tsx
import React from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ah-card">
          <h2>Something went wrong</h2>
          <button
            className="ah-btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Reference Apps

Study these for examples:

- **Bulls and Cows** - Multiplayer guessing game with full awareness
- **Tic Tac Toe** - Turn-based game with session tracking
- **Dice** - Simple utility app with minimal complexity

All use the standard Vite + SDK pattern.

---

## Troubleshooting

### Build warnings about source maps

**Symptom:** Warnings like "Failed to parse source map from activity-hub-sdk/src/..."

**Cause:** SDK publishes compiled JS, not TypeScript sources

**Solution:** These are harmless warnings. Vite ignores them. If using react-scripts, they're just noise.

### Assets not loading in production

**Symptom:** Blank page, 404s for CSS/JS files

**Fix:** Check `vite.config.ts` has correct `base` path:
```typescript
base: '/api/apps/your-app-name/proxy/',
```

### Authentication not working

**Symptom:** User always undefined

**Fix:** Ensure you're using `useActivityHubContext` and checking `isLoading`:
```tsx
const { user, isLoading } = useActivityHubContext();
if (isLoading) return <div>Loading...</div>;
```

### SSE connection fails

**Symptom:** `useSSE` shows `isConnected: false`

**Fix:**
1. Check backend has `auth.SSEMiddleware` on SSE routes
2. Verify `appId` and `gameId` match what backend expects
3. Check browser console for CORS or auth errors

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-23 | Initial guide with Vite standard |

---

## Support

- **Documentation:** `activity-hub/frontend/docs/`
- **CSS Reference:** `activity-hub/frontend/docs/CSS_GUIDE.md`
- **SDK Source:** `activity-hub/sdk/src/`
- **Example Apps:** Bulls and Cows, Tic Tac Toe, Dice

---

**Questions?** Review existing mini-apps or check Activity Hub's main documentation.
