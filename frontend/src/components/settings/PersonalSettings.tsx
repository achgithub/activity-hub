import React, { useState, useEffect } from 'react';
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

const PersonalSettings: React.FC<PersonalSettingsProps> = ({ apps, onClose, onSave }) => {
  const [appPreferences, setAppPreferences] = useState<AppPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
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
    setLoading(false);
  };

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
