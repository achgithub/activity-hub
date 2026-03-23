/**
 * @activity-hub/sdk - React Hooks for Awareness Service
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { UserAwareness, SessionParticipant, AwarenessEvent } from './types';
import { AwarenessClient } from './awareness';

const API_BASE = `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001/api/awareness`;

// Global awareness client instance (one per session)
let globalAwarenessClient: AwarenessClient | null = null;

// Hook for presence (heartbeat and status management)
export function useAwareness(userId: string, displayName: string) {
  const [status, setStatus] = useState<string>('online');
  const [onlineUsers, setOnlineUsers] = useState<UserAwareness[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const clientRef = useRef<AwarenessClient | null>(null);

  // Initialize awareness client
  useEffect(() => {
    if (!userId) return;

    // Reuse global client or create new one
    if (!globalAwarenessClient) {
      globalAwarenessClient = new AwarenessClient(API_BASE, userId, displayName);
    }
    clientRef.current = globalAwarenessClient;

    // Initialize client
    globalAwarenessClient.initialize().then(() => {
      setIsInitialized(true);
    });

    // Subscribe to presence updates
    const handlePresenceUpdate = (event: AwarenessEvent) => {
      if (event.type === 'presence_update') {
        console.log('🔄 Presence update:', event.data);
        // Could update UI with this data
      }
    };

    globalAwarenessClient.on('presence', handlePresenceUpdate);

    return () => {
      globalAwarenessClient?.off('presence', handlePresenceUpdate);
    };
  }, [userId, displayName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.cleanup();
        globalAwarenessClient = null;
      }
    };
  }, []);

  const changeStatus = useCallback(
    async (newStatus: string) => {
      if (!clientRef.current) return;

      try {
        await clientRef.current.setStatus(newStatus);
        setStatus(newStatus);
      } catch (err) {
        console.error('Failed to change status:', err);
      }
    },
    []
  );

  return {
    status,
    setStatus: changeStatus,
    onlineUsers,
    isInitialized,
    client: clientRef.current,
  };
}

// Hook for session awareness (multiplayer games)
export function useSessionAwareness(
  userId: string,
  displayName: string,
  appId: string | null,
  sessionId: string | null
) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [isInSession, setIsInSession] = useState(false);
  const clientRef = useRef<AwarenessClient | null>(null);
  const hasJoinedRef = useRef(false);

  // Initialize and join session
  useEffect(() => {
    if (!userId || !appId || !sessionId) return;

    // Initialize awareness client if not already done
    if (!globalAwarenessClient) {
      globalAwarenessClient = new AwarenessClient(API_BASE, userId, displayName);
      globalAwarenessClient.initialize();
    }
    clientRef.current = globalAwarenessClient;

    // Join session
    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;

      globalAwarenessClient
        .joinSession(appId, sessionId)
        .then(async () => {
          setIsInSession(true);

          // Get initial participants
          const participants = await globalAwarenessClient!.getSessionParticipants(appId, sessionId);
          setParticipants(participants);
        })
        .catch(err => {
          console.error('Failed to join session:', err);
          hasJoinedRef.current = false;
        });

      // Subscribe to session updates
      const handleSessionEvent = (event: AwarenessEvent) => {
        console.log('📢 Session event:', event.type, event.data);

        if (event.type === 'session_state') {
          setParticipants(event.data.participants || []);
        } else if (event.type === 'participant_joined' || event.type === 'participant_left') {
          // Refetch participants
          globalAwarenessClient!.getSessionParticipants(appId, sessionId)
            .then(setParticipants)
            .catch(err => console.error('Failed to fetch participants:', err));
        }
      };

      globalAwarenessClient.on(`session:${appId}:${sessionId}`, handleSessionEvent);

      return () => {
        globalAwarenessClient?.off(`session:${appId}:${sessionId}`, handleSessionEvent);
      };
    }
  }, [userId, displayName, appId, sessionId]);

  // Leave session on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current && hasJoinedRef.current && appId && sessionId) {
        clientRef.current
          .leaveSession(appId, sessionId)
          .catch(err => console.warn('Failed to leave session on unmount:', err));
        hasJoinedRef.current = false;
      }
    };
  }, [appId, sessionId]);

  const joinSession = useCallback(async () => {
    if (!clientRef.current || !appId || !sessionId) return;

    try {
      await clientRef.current.joinSession(appId, sessionId);
      setIsInSession(true);

      const participants = await clientRef.current.getSessionParticipants(appId, sessionId);
      setParticipants(participants);
    } catch (err) {
      console.error('Failed to join session:', err);
    }
  }, [appId, sessionId]);

  const leaveSession = useCallback(async () => {
    if (!clientRef.current || !appId || !sessionId) return;

    try {
      await clientRef.current.leaveSession(appId, sessionId);
      setIsInSession(false);
      setParticipants([]);
      hasJoinedRef.current = false;
    } catch (err) {
      console.error('Failed to leave session:', err);
    }
  }, [appId, sessionId]);

  return {
    participants,
    joinSession,
    leaveSession,
    isInSession,
    client: clientRef.current,
  };
}

// Hook for SSE connections with auto-reconnect
export function useSSE<T>(
  url: string | null,
  onEvent: (event: T) => void,
  options?: {
    appId?: string;
    gameId?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  }
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number>();
  const reconnectAttemptsRef = useRef(0);
  const maxAttempts = options?.maxReconnectAttempts ?? 5;
  const reconnectInterval = options?.reconnectInterval ?? 5000;

  const connect = useCallback(async () => {
    if (!url) return;

    if (streamRef.current) {
      streamRef.current.close();
    }

    try {
      let finalUrl = url;

      // If appId and gameId are provided, request SSE token
      if (options?.appId && options?.gameId) {
        console.log(`📡 Requesting SSE token for ${options.appId}/${options.gameId}`);
        const { requestSSEToken } = await import('./sseToken');
        const sseToken = await requestSSEToken(options.appId, options.gameId);

        // Add token to URL
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}token=${encodeURIComponent(sseToken)}`;
      }

      console.log(`📡 Connecting to SSE: ${finalUrl}`);
      const stream = new EventSource(finalUrl);

      stream.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as T;
          onEvent(data);
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      stream.onerror = () => {
        console.error(`❌ SSE error: ${url}`);
        stream.close();
        setIsConnected(false);
        setError(new Error('SSE connection error'));

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxAttempts})...`);
          reconnectTimerRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setError(new Error('Max reconnection attempts reached'));
        }
      };

      streamRef.current = stream;
    } catch (err) {
      console.error('Failed to establish SSE connection:', err);
      setError(err as Error);
      setIsConnected(false);

      // Attempt to reconnect on token request failure
      if (reconnectAttemptsRef.current < maxAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`🔄 Reconnecting after error (attempt ${reconnectAttemptsRef.current}/${maxAttempts})...`);
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [url, onEvent, maxAttempts, reconnectInterval, options?.appId, options?.gameId]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (streamRef.current) {
        streamRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [url, connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    isConnected,
    error,
    reconnect,
  };
}
