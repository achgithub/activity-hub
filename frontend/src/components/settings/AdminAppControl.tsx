import React, { useState, useEffect } from 'react';
import { AppDefinition } from '@activity-hub/core';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminAppControlProps {
  apps: AppDefinition[];
  onClose: () => void;
  onSave: () => void;
}

const AdminAppControl: React.FC<AdminAppControlProps> = ({ apps, onClose, onSave }) => {
  const [appStates, setAppStates] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize app states from current apps
    const states = new Map<string, boolean>();
    apps.forEach(app => {
      states.set(app.id, app.enabled !== false);
    });
    setAppStates(states);
  }, [apps]);

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

  const enabledApps = apps.filter(app => appStates.get(app.id) !== false);
  const disabledApps = apps.filter(app => appStates.get(app.id) === false);

  return (
    <>
      <div className="ah-modal-body">
        <p className="text-gray-600 mb-6">
          Enable or disable apps for all users. Disabled apps will be hidden from the lobby.
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
                  <button
                    className="ah-btn-danger ah-btn-sm"
                    onClick={() => handleToggleApp(app.id)}
                    disabled={loading}
                  >
                    Disable
                  </button>
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
                  <button
                    className="ah-btn-primary ah-btn-sm"
                    onClick={() => handleToggleApp(app.id)}
                    disabled={loading}
                  >
                    Enable
                  </button>
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
