import { useState, useEffect } from 'react';
import { ActivityHubContext } from './types';

const API_BASE = `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001/api`;

/**
 * Hook to access Activity Hub context including user roles
 *
 * Usage:
 * ```tsx
 * const { roles, user, isTestMode } = useActivityHubContext();
 *
 * if (roles.hasApp('admin')) {
 *   return <AdminPanel />;
 * }
 * ```
 *
 * Role patterns:
 * - Activity Hub roles: 'ah_r_app_register', 'ah_r_app_control'
 * - Activity Hub groups: 'ah_g_super', 'ah_g_admin'
 * - App-specific roles: 'chess:admin', 'chess:player', 'leaderboard:guest'
 */
export function useActivityHubContext(): ActivityHubContext {
  const [context, setContext] = useState<ActivityHubContext>({
    user: { email: '', name: '' },
    roles: {
      all: [],
      ah_roles: [],
      app_roles: [],
      has: () => false,
      hasApp: () => false,
      hasAny: () => false,
      hasAll: () => false,
      isAdmin: false,
    },
    isTestMode: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE}/user/context`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch context: ${response.statusText}`);
        }

        const data = await response.json();

        // Separate roles by type
        const roles = data.roles || [];
        const ah_roles = roles.filter((r: string) => r.startsWith('ah_'));
        const app_roles = roles.filter((r: string) => r.includes(':'));

        // Create helper functions
        const has = (role: string) => roles.includes(role);
        const hasAny = (roleList: string[]) => roleList.some(r => roles.includes(r));
        const hasAll = (roleList: string[]) => roleList.every(r => roles.includes(r));

        // hasApp checks for app-specific role without requiring full "app:" prefix
        const hasApp = (rolePattern: string) => {
          // If pattern already has ":", check exact match
          if (rolePattern.includes(':')) {
            return roles.includes(rolePattern);
          }
          // Otherwise check for "app:{pattern}" pattern
          // This allows hasApp('admin') to match 'chess:admin' when called from chess app
          const appId = data.appId || '';
          if (appId) {
            return roles.includes(`${appId}:${rolePattern}`);
          }
          // Fallback: check if any role ends with ":pattern"
          return roles.some((r: string) => r.endsWith(`:${rolePattern}`));
        };

        const isAdmin = ah_roles.length > 0 || roles.some((r: string) => r === 'ah_g_super' || r === 'ah_g_admin');

        setContext({
          user: {
            email: data.user?.email || '',
            name: data.user?.name || '',
          },
          roles: {
            all: roles,
            ah_roles,
            app_roles,
            has,
            hasApp,
            hasAny,
            hasAll,
            isAdmin,
          },
          isTestMode: data.isTestMode || false,
        });

        setError(null);
      } catch (err) {
        console.error('Failed to fetch Activity Hub context:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, []);

  if (loading) {
    // Return default context while loading
    return context;
  }

  if (error) {
    console.warn('Activity Hub context error:', error);
    // Return context anyway - app can still function
  }

  return context;
}

export default useActivityHubContext;
