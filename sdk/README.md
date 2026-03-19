# Activity Hub SDK

React SDK for building mini-apps that integrate with the Activity Hub platform. Provides hooks and utilities for awareness (user presence, status, live activity) and context management.

## Features

- **Awareness Hooks** - Track user presence, status, and real-time activity
- **Context Integration** - Access Activity Hub context from mini-app components
- **Type Definitions** - Full TypeScript support with bundled type definitions
- **React Hooks** - Simple, composable React hooks for common Activity Hub patterns

## Installation

```bash
npm install @activity-hub/sdk
```

## Quick Start

### 1. Import the SDK in Your App

```typescript
import { useAwareness, useActivityHubContext } from '@activity-hub/sdk';
```

### 2. Use Awareness to Track Online Users

```tsx
import React from 'react';
import { useAwareness, OnlineUsersList } from '@activity-hub/sdk';

export function MyGameLobby() {
  const { onlineUsers } = useAwareness();

  return (
    <div>
      <h2>Players Online ({onlineUsers.length})</h2>
      <OnlineUsersList
        users={onlineUsers}
        onUserClick={(user) => console.log('Clicked:', user)}
      />
    </div>
  );
}
```

### 3. Access Activity Hub Context

```tsx
import { useActivityHubContext } from '@activity-hub/sdk';

export function MyComponent() {
  const { currentUser, activities, sendMessage } = useActivityHubContext();

  return <div>Welcome, {currentUser?.displayName}!</div>;
}
```

## Hooks Reference

### useAwareness()

Track user presence and status across the platform.

```typescript
const {
  onlineUsers,        // All users currently online
  currentUser,        // Current user's awareness info
  userStatus,         // Current user's status (online, away, dnd)
  setUserStatus,      // Update current user's status
  sessionParticipants // Users in current session
} = useAwareness();
```

**Parameters:**
- None

**Returns:**
```typescript
{
  onlineUsers: UserAwareness[];
  currentUser: UserAwareness | null;
  userStatus: StatusLevel;
  setUserStatus: (status: StatusLevel) => Promise<void>;
  sessionParticipants: SessionParticipant[];
}
```

### useSessionAwareness(sessionId)

Track participants in a specific session (game, challenge, etc).

```typescript
const { participants, addParticipant, removeParticipant } = useSessionAwareness('game-123');
```

### useActivityHubContext()

Access the Activity Hub application context.

```typescript
const { currentUser, activities, sendMessage } = useActivityHubContext();
```

## Type Definitions

All types are bundled with the SDK:

```typescript
import {
  User,
  UserAwareness,
  StatusLevels,
  SessionParticipant,
  AwarenessEvent,
  AppDefinition,
  Challenge,
  GameConfig,
  // ... and many more
} from '@activity-hub/sdk';
```

## Components

The SDK includes ready-to-use awareness components:

```tsx
import {
  OnlineUsersList,
  SessionParticipants,
  StatusSelector,
  PresenceBadge
} from '@activity-hub/sdk';
```

### OnlineUsersList

Display all online users.

```tsx
<OnlineUsersList
  users={onlineUsers}
  onUserClick={(user) => console.log('Clicked:', user)}
  showStatus={true}
  showCurrentApp={true}
  emptyMessage="No users online"
/>
```

### SessionParticipants

Show participants in a specific session.

```tsx
<SessionParticipants
  participants={sessionParticipants}
  currentUserId={currentUser.userId}
  showGracePeriod={true}
  maxDisplay={10}
/>
```

### StatusSelector

Let users change their presence status.

```tsx
<StatusSelector
  currentStatus={userStatus}
  onChange={setUserStatus}
  disabled={false}
/>
```

### PresenceBadge

Show a user's status indicator.

```tsx
<PresenceBadge status="online" size="sm" />
```

## Examples

### Complete Mini-App Example

```tsx
import React from 'react';
import {
  useAwareness,
  useActivityHubContext,
  OnlineUsersList,
  StatusSelector
} from '@activity-hub/sdk';

export default function MyGame() {
  const { onlineUsers, userStatus, setUserStatus } = useAwareness();
  const { currentUser } = useActivityHubContext();

  return (
    <div>
      <header>
        <h1>My Awesome Game</h1>
        <StatusSelector
          currentStatus={userStatus}
          onChange={setUserStatus}
        />
      </header>

      <main>
        <div className="players">
          <h2>Available Players</h2>
          <OnlineUsersList
            users={onlineUsers.filter(u => u.userId !== currentUser?.userId)}
            onUserClick={(user) => console.log('Invite', user)}
          />
        </div>

        <div className="game-board">
          {/* Your game UI here */}
        </div>
      </main>
    </div>
  );
}
```

## Configuration

The SDK is automatically configured by the Activity Hub platform. No additional setup is required beyond importing hooks and components.

## Styling

The SDK uses Activity Hub's unified CSS system. Make sure your app imports the Activity Hub CSS:

```typescript
// In your app's entry point
import '@activity-hub/ui/styles/activity-hub.css';
```

All SDK components use `.ah-*` utility classes for consistent styling.

## Development

### Building

```bash
npm run build      # TypeScript compilation to dist/
npm run dev        # Watch mode for development
```

### Publishing

```bash
npm publish        # Publish to npm registry
npm publish --dry-run  # Preview what would be published
```

## Support

For issues, questions, or contributions, please refer to the main Activity Hub repository:
https://github.com/your-org/activity-hub

## License

MIT
