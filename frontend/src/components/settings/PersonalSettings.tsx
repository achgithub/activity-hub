import React, { useState, useEffect, useCallback } from 'react';
import { AppDefinition } from '../../types';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface PersonalSettingsProps {
  apps: AppDefinition[];
  onClose: () => void;
  onSave: () => void;
}

interface AppPreference {
  appId: string;
  isHidden: boolean;
  isFavorite: boolean;
  customOrder: number | null;
}

interface BlockedUser {
  id: number;
  blocker_email: string;
  blocked_email: string;
  created_at: string;
}

const PersonalSettings: React.FC<PersonalSettingsProps> = ({ apps, onClose, onSave }) => {
  const [appPreferences, setAppPreferences] = useState<AppPreference[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockEmail, setBlockEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const fetchBlockedUsers = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/lobby/blocks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/user/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      const prefsMap = new Map<string, AppPreference>();
      if (data.preferences) {
        data.preferences.forEach((pref: any) => {
          prefsMap.set(pref.appId, {
            appId: pref.appId,
            isHidden: pref.isHidden,
            isFavorite: pref.isFavorite || false,
            customOrder: pref.customOrder
          });
        });
      }

      const allPrefs = apps
        .filter(app => app.id !== 'lobby')
        .map((app) => {
          const existing = prefsMap.get(app.id);
          return {
            appId: app.id,
            isHidden: existing?.isHidden || false,
            isFavorite: existing?.isFavorite || false,
            customOrder: existing?.customOrder !== null && existing?.customOrder !== undefined
              ? existing.customOrder
              : (app.displayOrder ?? null)
          };
        });

      allPrefs.sort((a, b) => {
        const aOrder = (a.customOrder !== null && a.customOrder !== undefined) ? a.customOrder : 999;
        const bOrder = (b.customOrder !== null && b.customOrder !== undefined) ? b.customOrder : 999;
        return aOrder - bOrder;
      });

      setAppPreferences(allPrefs);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  }, [apps]);

  useEffect(() => {
    Promise.all([fetchPreferences(), fetchBlockedUsers()]).finally(() => setLoading(false));
  }, [fetchPreferences, fetchBlockedUsers]);

  const handleToggleVisibility = (appId: string) => {
    setAppPreferences(prefs =>
      prefs.map(p => p.appId === appId ? { ...p, isHidden: !p.isHidden } : p)
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    setAppPreferences(prefs => {
      const newPrefs = [...prefs];
      [newPrefs[index - 1], newPrefs[index]] = [newPrefs[index], newPrefs[index - 1]];
      return newPrefs.map((p, i) => ({ ...p, customOrder: i * 10 }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === appPreferences.length - 1) return;

    setAppPreferences(prefs => {
      const newPrefs = [...prefs];
      [newPrefs[index], newPrefs[index + 1]] = [newPrefs[index + 1], newPrefs[index]];
      return newPrefs.map((p, i) => ({ ...p, customOrder: i * 10 }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/user/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferences: appPreferences })
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        alert('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all app settings to default? This will unhide all apps and restore original order.')) {
      return;
    }

    const resetPrefs = apps
      .filter(app => app.id !== 'lobby')
      .map((app, index) => ({
        appId: app.id,
        isHidden: false,
        isFavorite: false,
        customOrder: app.displayOrder ?? index * 10
      }));

    resetPrefs.sort((a, b) => {
      const aOrder = (a.customOrder !== null && a.customOrder !== undefined) ? a.customOrder : 999;
      const bOrder = (b.customOrder !== null && b.customOrder !== undefined) ? b.customOrder : 999;
      return aOrder - bOrder;
    });

    setAppPreferences(resetPrefs);
  };

  const getAppName = (appId: string) => {
    const app = apps.find(a => a.id === appId);
    return app ? `${app.icon} ${app.name}` : appId;
  };

  const handleBlockUser = async () => {
    if (!blockEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    setBlockLoading(true);
    try {
      const response = await fetch(`${API_BASE}/lobby/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ blocked_email: blockEmail.trim() })
      });

      if (response.ok) {
        await fetchBlockedUsers();
        setBlockEmail('');
      } else {
        const error = await response.text();
        alert(error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      alert('Failed to block user');
    }
    setBlockLoading(false);
  };

  const handleUnblockUser = async (blockedEmail: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/lobby/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ blocked_email: blockedEmail })
      });

      if (response.ok) {
        await fetchBlockedUsers();
      } else {
        alert('Failed to unblock user');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      alert('Failed to unblock user');
    }
  };

  return (
    <>
      {loading ? (
        <div className="ah-modal-body text-center py-8">Loading preferences...</div>
      ) : (
        <>
          <div className="ah-modal-body">
            <p className="text-gray-600 mb-6">
              Show/hide apps and reorder them to customize your experience.
            </p>
            <div className="ah-list">
              {appPreferences.map((pref, index) => (
                <div key={pref.appId} className="ah-list-item ah-flex ah-flex-between">
                  <label className="ah-flex ah-flex-center gap-3 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!pref.isHidden}
                      onChange={() => handleToggleVisibility(pref.appId)}
                    />
                    <span className={pref.isHidden ? 'text-gray-400' : 'text-gray-900'}>
                      {getAppName(pref.appId)}
                    </span>
                  </label>
                  <div className="ah-flex gap-1">
                    <button
                      className="ah-btn-outline ah-btn-sm"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="ah-btn-outline ah-btn-sm"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === appPreferences.length - 1}
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Blocked Users Section */}
            <div className="border-t mt-6 pt-6">
              <h3 className="text-lg font-semibold mb-3">🚫 Blocked Users</h3>
              <p className="text-gray-600 mb-4">
                Blocked users cannot see you online or send you challenges. You also won't see them.
              </p>

              {/* Block new user */}
              <div className="ah-flex gap-2 mb-4">
                <input
                  type="email"
                  className="ah-input flex-1"
                  placeholder="Enter email to block..."
                  value={blockEmail}
                  onChange={(e) => setBlockEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBlockUser()}
                />
                <button
                  className="ah-btn-primary"
                  onClick={handleBlockUser}
                  disabled={blockLoading || !blockEmail.trim()}
                >
                  {blockLoading ? 'Blocking...' : 'Block'}
                </button>
              </div>

              {/* List of blocked users */}
              {blockedUsers.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No blocked users</p>
              ) : (
                <div className="ah-list">
                  {blockedUsers.map((block) => (
                    <div key={block.id} className="ah-list-item ah-flex ah-flex-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{block.blocked_email}</div>
                        <div className="text-xs text-gray-500">
                          Blocked {new Date(block.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        className="ah-btn-outline ah-btn-sm"
                        onClick={() => handleUnblockUser(block.blocked_email)}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ah-modal-footer ah-flex ah-flex-between">
            <button className="ah-btn-danger" onClick={handleReset}>
              Reset to Default
            </button>
            <div className="ah-flex gap-2">
              <button className="ah-btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button className="ah-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default PersonalSettings;
