/**
 * @activity-hub/sdk - Awareness Service Client
 * Handles user presence, status management, and multiplayer session tracking
 */

import {
  UserAwareness,
  SessionParticipant,
  HeartbeatRequest,
  AwarenessEvent,
  SessionJoinRequest,
  SessionLeaveRequest,
} from '@activity-hub/core';

export class AwarenessClient {
  private baseURL: string;
  private userId: string;
  private displayName: string;
  private currentStatus: string = 'online';
  private currentApp?: string;
  private currentSession?: string;

  private heartbeatTimer?: number;
  private presenceStream?: EventSource;
  private sessionStreams: Map<string, EventSource> = new Map();

  private listeners: Map<string, Set<(event: AwarenessEvent) => void>> = new Map();

  constructor(baseURL: string, userId: string, displayName: string) {
    this.baseURL = baseURL;
    this.userId = userId;
    this.displayName = displayName;

    // Setup visibility handling (go away when tab hidden)
    this.setupVisibilityHandling();
  }

  // Initialize awareness (start heartbeat)
  async initialize(): Promise<void> {
    console.log('🚀 Initializing awareness client for', this.userId);
    this.startHeartbeat();
    this.connectPresenceStream();
  }

  // Start heartbeat every 20 seconds
  private startHeartbeat(): void {
    this.sendHeartbeat(); // Send immediately
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 20000); // 20 seconds
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // Send heartbeat to backend
  private async sendHeartbeat(): Promise<void> {
    try {
      const req: HeartbeatRequest = {
        userId: this.userId,
        displayName: this.displayName,
        status: this.currentStatus,
        currentApp: this.currentApp,
        platform: 'web',
      };

      const response = await fetch(`${this.baseURL}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        console.warn('⚠️  Heartbeat failed:', response.statusText);
      }
    } catch (err) {
      console.warn('⚠️  Heartbeat error:', err);
    }
  }

  // Change status manually
  async setStatus(status: string): Promise<void> {
    this.currentStatus = status;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to change status: ${response.statusText}`);
      }

      console.log('✅ Status changed to', status);
    } catch (err) {
      console.error('❌ Failed to change status:', err);
      throw err;
    }
  }

  // Connect to presence SSE stream
  connectPresenceStream(onEvent?: (event: AwarenessEvent) => void): void {
    if (onEvent) {
      const listeners = this.listeners.get('presence') || new Set();
      listeners.add(onEvent);
      this.listeners.set('presence', listeners);
    }

    if (this.presenceStream) {
      return; // Already connected
    }

    console.log('📡 Connecting to presence stream');
    this.presenceStream = new EventSource(`${this.baseURL}/stream`);

    this.presenceStream.onmessage = (event: MessageEvent) => {
      try {
        const awarenessEvent = JSON.parse(event.data) as AwarenessEvent;
        this.notifyListeners('presence', awarenessEvent);
      } catch (err) {
        console.error('❌ Failed to parse presence event:', err);
      }
    };

    this.presenceStream.onerror = () => {
      console.error('❌ Presence stream error');
      this.disconnectPresenceStream();
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectPresenceStream(), 5000);
    };
  }

  // Disconnect presence stream
  disconnectPresenceStream(): void {
    if (this.presenceStream) {
      this.presenceStream.close();
      this.presenceStream = undefined;
      console.log('📴 Disconnected from presence stream');
    }
  }

  // Join game session
  async joinSession(appId: string, sessionId: string): Promise<void> {
    this.currentApp = appId;
    this.currentSession = sessionId;
    this.currentStatus = 'in_game';

    try {
      const token = localStorage.getItem('token');
      const req: SessionJoinRequest = { appId, sessionId };

      const response = await fetch(`${this.baseURL}/sessions/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.statusText}`);
      }

      console.log(`✅ Joined session ${sessionId} for app ${appId}`);

      // Connect to session stream
      this.connectSessionStream(appId, sessionId);
    } catch (err) {
      console.error('❌ Failed to join session:', err);
      this.currentStatus = 'online';
      throw err;
    }
  }

  // Leave game session
  async leaveSession(appId: string, sessionId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const req: SessionLeaveRequest = { appId, sessionId };

      const response = await fetch(`${this.baseURL}/sessions/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`Failed to leave session: ${response.statusText}`);
      }

      console.log(`✅ Left session ${sessionId}`);

      // Disconnect from session stream
      this.disconnectSessionStream(appId, sessionId);

      this.currentStatus = 'online';
      this.currentApp = undefined;
      this.currentSession = undefined;
    } catch (err) {
      console.error('❌ Failed to leave session:', err);
      throw err;
    }
  }

  // Get session participants
  async getSessionParticipants(appId: string, sessionId: string): Promise<SessionParticipant[]> {
    try {
      const response = await fetch(`${this.baseURL}/sessions/${appId}/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to get participants: ${response.statusText}`);
      }

      const data = await response.json();
      return data.participants || [];
    } catch (err) {
      console.error('❌ Failed to get participants:', err);
      return [];
    }
  }

  // Connect to session SSE stream
  connectSessionStream(appId: string, sessionId: string, onEvent?: (event: AwarenessEvent) => void): void {
    const channelId = `session:${appId}:${sessionId}`;

    if (onEvent) {
      const listeners = this.listeners.get(channelId) || new Set();
      listeners.add(onEvent);
      this.listeners.set(channelId, listeners);
    }

    if (this.sessionStreams.has(channelId)) {
      return; // Already connected
    }

    console.log(`📡 Connecting to session stream: ${channelId}`);
    const stream = new EventSource(`${this.baseURL}/sessions/stream/${appId}/${sessionId}`);

    stream.onmessage = (event: MessageEvent) => {
      try {
        const awarenessEvent = JSON.parse(event.data) as AwarenessEvent;
        this.notifyListeners(channelId, awarenessEvent);
      } catch (err) {
        console.error('❌ Failed to parse session event:', err);
      }
    };

    stream.onerror = () => {
      console.error(`❌ Session stream error: ${channelId}`);
      this.disconnectSessionStream(appId, sessionId);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectSessionStream(appId, sessionId), 5000);
    };

    this.sessionStreams.set(channelId, stream);
  }

  // Disconnect session stream
  disconnectSessionStream(appId: string, sessionId: string): void {
    const channelId = `session:${appId}:${sessionId}`;
    const stream = this.sessionStreams.get(channelId);

    if (stream) {
      stream.close();
      this.sessionStreams.delete(channelId);
      console.log(`📴 Disconnected from session stream: ${channelId}`);
    }
  }

  // Register event listener
  on(event: string, listener: (event: AwarenessEvent) => void): void {
    const listeners = this.listeners.get(event) || new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  // Unregister event listener
  off(event: string, listener: (event: AwarenessEvent) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Notify listeners
  private notifyListeners(channel: string, event: AwarenessEvent): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          console.error('❌ Error in listener:', err);
        }
      });
    }
  }

  // Setup visibility handling (go away when tab hidden)
  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('👋 Tab hidden, setting status to away');
        this.setStatus('away').catch(err => console.warn('Failed to set away status:', err));
      } else {
        console.log('👀 Tab visible, setting status to online');
        this.setStatus('online').catch(err => console.warn('Failed to set online status:', err));
      }
    });
  }

  // Cleanup all connections
  cleanup(): void {
    console.log('🧹 Cleaning up awareness client');
    this.stopHeartbeat();
    this.disconnectPresenceStream();

    // Disconnect all session streams
    for (const [channelId, stream] of this.sessionStreams.entries()) {
      stream.close();
    }
    this.sessionStreams.clear();

    // Clear listeners
    this.listeners.clear();

    // Leave any active session
    if (this.currentSession && this.currentApp) {
      this.leaveSession(this.currentApp, this.currentSession).catch(err =>
        console.warn('Failed to leave session on cleanup:', err)
      );
    }
  }
}
