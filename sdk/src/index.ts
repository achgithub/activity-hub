/**
 * @activity-hub/sdk
 * SDK for Activity Hub mini-apps with hooks, utilities, and UI components
 */

// Auto-load shared CSS
import './styles/loadSharedCSS';

// Hooks and utilities
export { AwarenessClient } from './awareness';
export { useAwareness, useSessionAwareness, useSSE } from './useAwareness';
export { useActivityHubContext } from './useActivityHubContext';
export { requestSSEToken, createSecureEventSource } from './sseToken';

// UI Components
export { AppHeader } from './components/AppHeader';
export type { AppHeaderProps } from './components/AppHeader';
export { GameCard } from './components/GameCard';
export type { GameCardProps } from './components/GameCard';
