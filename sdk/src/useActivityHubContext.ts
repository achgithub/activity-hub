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
    user: { email: '', name: '', isGuest: false },
    roles: {
      all: [],
      ah_roles: [],
      app_roles: [],
      has: () => false,
      hasApp: () => false,
      hasAny: () => false,
      hasAll: () => false,
      hasTabAccess: () => false,
      getAccessibleTabs: () => [],
      isAdmin: false,
    },
    isTestMode: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        // Try to get token from multiple sources:
        // 1. localStorage (standalone mode or Activity Hub main shell)
        // 2. URL query parameter (mini-app mode - passed by Activity Hub)
        let token = localStorage.getItem('token');

        if (!token && typeof window !== 'undefined') {
          // Extract token from URL query parameter for mini-app mode
          const params = new URLSearchParams(window.location.search);
          token = params.get('token');
        }

        // Guest mode: no token, return guest context
        if (!token) {
          setContext({
            user: { email: '', name: 'Guest', isGuest: true },
            roles: {
              all: [],
              ah_roles: [],
              app_roles: [],
              has: () => false,
              hasApp: () => false,
              hasAny: () => false,
              hasAll: () => false,
              hasTabAccess: () => false,
              getAccessibleTabs: () => [],
              isAdmin: false,
            },
            isTestMode: false,
          });
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

        // Standardized admin check: has any ah_g_* group OR ah_r_user_manage OR ah_r_app_control
        const isAdmin = roles.some((r: string) =>
          r.startsWith('ah_g_') ||
          r === 'ah_r_user_manage' ||
          r === 'ah_r_app_control'
        );

        // Extract appId from URL if available
        const params = new URLSearchParams(window.location.search);
        const appId = params.get('appId') || data.appId || '';

        // Tab-based access control
        // Convention: Left tabs = more privileges, right tabs = less privileges
        // Having a role grants access to that tab + all tabs to its right
        const hasTabAccess = (tabName: string, tabOrder: string[]): boolean => {
          // Check for wildcard role (appId:all)
          if (appId && has(`${appId}:all`)) {
            return true;
          }

          // Find position of requested tab
          const requestedTabPos = tabOrder.indexOf(tabName);
          if (requestedTabPos === -1) {
            return false; // Tab not found
          }

          // Check if user has role for this tab or any tab to its left
          // Left tabs grant access to right tabs
          for (let i = 0; i <= requestedTabPos; i++) {
            const role = appId ? `${appId}:${tabOrder[i]}` : tabOrder[i];
            if (has(role)) {
              return true;
            }
          }

          return false;
        };

        const getAccessibleTabs = (tabOrder: string[]): string[] => {
          return tabOrder.filter(tab => hasTabAccess(tab, tabOrder));
        };

        setContext({
          user: {
            email: data.user?.email || '',
            name: data.user?.name || '',
            isGuest: false,
          },
          roles: {
            all: roles,
            ah_roles,
            app_roles,
            has,
            hasApp,
            hasAny,
            hasAll,
            hasTabAccess,
            getAccessibleTabs,
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
