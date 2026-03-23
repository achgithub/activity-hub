/**
 * SSE Token Management
 *
 * Provides utilities for requesting short-lived SSE tokens for secure
 * EventSource connections. SSE tokens expire in 5 minutes and prevent
 * long-lived JWT tokens from appearing in URL query parameters.
 */

const API_BASE = `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001`;

interface SSETokenResponse {
  success: boolean;
  sseToken: string;
  expiresIn: number; // seconds
}

/**
 * Request a short-lived SSE token for an EventSource connection
 *
 * @param appId - The app/service identifier (e.g., "lobby", "awareness", "tic-tac-toe")
 * @param gameId - The session/game identifier (e.g., "global", sessionId, gameId)
 * @returns The SSE token string
 * @throws Error if token generation fails or user is not authenticated
 */
export async function requestSSEToken(appId: string, gameId: string): Promise<string> {
  // Get the main JWT token from localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }

  try {
    const response = await fetch(`${API_BASE}/api/sse-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        appId,
        gameId,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      throw new Error(`Failed to generate SSE token: ${response.statusText}`);
    }

    const data: SSETokenResponse = await response.json();

    if (!data.success || !data.sseToken) {
      throw new Error('Invalid SSE token response from server');
    }

    return data.sseToken;
  } catch (error) {
    console.error('Failed to request SSE token:', error);
    throw error;
  }
}

/**
 * Create an EventSource with automatic SSE token fetching
 *
 * @param url - The base URL for the EventSource (without token parameter)
 * @param appId - The app/service identifier
 * @param gameId - The session/game identifier
 * @returns Promise that resolves to the EventSource instance
 */
export async function createSecureEventSource(
  url: string,
  appId: string,
  gameId: string
): Promise<EventSource> {
  const sseToken = await requestSSEToken(appId, gameId);

  // Add token to URL
  const separator = url.includes('?') ? '&' : '?';
  const secureUrl = `${url}${separator}token=${encodeURIComponent(sseToken)}`;

  return new EventSource(secureUrl);
}
