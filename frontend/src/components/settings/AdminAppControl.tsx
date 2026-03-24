import React, { useState, useEffect } from 'react';
import { AppDefinition } from '../../types';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminAppControlProps {
  apps: AppDefinition[];
  onClose: () => void;
  onSave: () => void;
  onEditApp?: (app: any) => void;
}

const AdminAppControl: React.FC<AdminAppControlProps> = ({ apps: _apps, onClose, onSave, onEditApp }) => {
  const [allApps, setAllApps] = useState<AppDefinition[]>([]);
  const [appStates, setAppStates] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [fetchingApps, setFetchingApps] = useState(true);

  // Fetch ALL apps from admin endpoint (includes disabled apps)
  useEffect(() => {
    const fetchAllApps = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`${API_BASE}/admin/apps`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch apps');
        }

        const data = await response.json();
        setAllApps(data.apps || []);

        // Initialize app states from fetched data
        const states = new Map<string, boolean>();
        (data.apps || []).forEach((app: AppDefinition) => {
          states.set(app.id, app.enabled ?? true);
        });
        setAppStates(states);
      } catch (err) {
        console.error('Failed to fetch all apps:', err);
        alert('Failed to load apps list');
      } finally {
        setFetchingApps(false);
      }
    };

    fetchAllApps();
  }, []);

  const handleToggleApp = async (appId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const newState = !appStates.get(appId);
      const action = newState ? 'enable' : 'disable';

      const response = await fetch(`${API_BASE}/admin/apps/${appId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} app`);
      }

      setAppStates(prev => new Map(prev).set(appId, newState));
      onSave();
    } catch (err) {
      console.error('Failed to toggle app:', err);
      alert('Failed to update app status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApp = async (appId: string, appName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to DELETE "${appName}"?\n\n` +
      `This will permanently remove:\n` +
      `- The app from the registry\n` +
      `- All app-specific roles\n` +
      `- All user role assignments for this app\n` +
      `- All related data\n\n` +
      `This action CANNOT be undone.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE}/admin/apps/${appId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(data.message || 'Failed to delete app');
      }

      // Remove app from local state
      setAllApps(prev => prev.filter(app => app.id !== appId));
      setAppStates(prev => {
        const newStates = new Map(prev);
        newStates.delete(appId);
        return newStates;
      });

      alert(`App "${appName}" has been deleted successfully`);
      onSave(); // Refresh parent app list
    } catch (err) {
      console.error('Failed to delete app:', err);
      alert(`Failed to delete app: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const enabledApps = allApps.filter(app => appStates.get(app.id) !== false);
  const disabledApps = allApps.filter(app => appStates.get(app.id) === false);

  if (fetchingApps) {
    return (
      <>
        <div className="ah-modal-body">
          <div className="text-center py-8">
            <p className="text-gray-500">Loading apps...</p>
          </div>
        </div>
        <div className="ah-modal-footer ah-flex ah-flex-between">
          <div />
          <button className="ah-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ah-modal-body">
        <p className="text-gray-600 mb-6">
          Enable or disable apps for all users. Disabled apps will be hidden from the lobby.
          Delete apps to permanently remove them and all related data.
        </p>

        {/* Enabled Apps */}
        <div className="mb-8">
          <h3 className="font-semibold mb-4">
            Enabled Apps ({enabledApps.length})
          </h3>
          {enabledApps.length === 0 ? (
            <p className="text-gray-500 italic">No enabled apps</p>
          ) : (
            <div className="ah-list">
              {enabledApps.map(app => (
                <div key={app.id} className="ah-list-item ah-flex ah-flex-between items-center">
                  <div className="flex-1">
                    <div className="font-medium">
                      {app.icon} {app.name}
                    </div>
                    <div className="text-sm text-gray-500">{app.description}</div>
                  </div>
                  <div className="ah-flex gap-2">
                    {onEditApp && (
                      <button
                        className="ah-btn-primary ah-btn-sm"
                        onClick={() => onEditApp(app)}
                        disabled={loading}
                        title="Edit app configuration"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="ah-btn-outline ah-btn-sm"
                      onClick={() => handleToggleApp(app.id)}
                      disabled={loading}
                    >
                      Disable
                    </button>
                    <button
                      className="ah-btn-danger ah-btn-sm"
                      onClick={() => handleDeleteApp(app.id, app.name)}
                      disabled={loading}
                      title="Permanently delete this app"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disabled Apps */}
        <div className="border-t pt-8">
          <h3 className="font-semibold mb-4">
            Disabled Apps ({disabledApps.length})
          </h3>
          {disabledApps.length === 0 ? (
            <p className="text-gray-500 italic">No disabled apps</p>
          ) : (
            <div className="ah-list">
              {disabledApps.map(app => (
                <div key={app.id} className="ah-list-item ah-flex ah-flex-between items-center opacity-60">
                  <div className="flex-1">
                    <div className="font-medium line-through">
                      {app.icon} {app.name}
                    </div>
                    <div className="text-sm text-gray-500">{app.description}</div>
                  </div>
                  <div className="ah-flex gap-2">
                    {onEditApp && (
                      <button
                        className="ah-btn-outline ah-btn-sm"
                        onClick={() => onEditApp(app)}
                        disabled={loading}
                        title="Edit app configuration"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="ah-btn-primary ah-btn-sm"
                      onClick={() => handleToggleApp(app.id)}
                      disabled={loading}
                    >
                      Enable
                    </button>
                    <button
                      className="ah-btn-danger ah-btn-sm"
                      onClick={() => handleDeleteApp(app.id, app.name)}
                      disabled={loading}
                      title="Permanently delete this app"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ah-modal-footer ah-flex ah-flex-between">
        <div />
        <div className="ah-flex gap-2">
          <button className="ah-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default AdminAppControl;
