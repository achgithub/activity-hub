import React, { useState } from 'react';
import { AppDefinition, User } from '../types';
import PersonalSettings from './settings/PersonalSettings';
import AdminAppRegistration from './settings/AdminAppRegistration';
import AdminAppControl from './settings/AdminAppControl';
import AdminUserManagement from './settings/AdminUserManagement';
import AdminRoleManagement from './settings/AdminRoleManagement';

interface SettingsProps {
  apps: AppDefinition[];
  user: User;
  onClose: () => void;
  onSave: () => void;
}

const Settings: React.FC<SettingsProps> = ({ apps, user, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'registration' | 'control' | 'users' | 'roles'>('personal');

  // Check if user is admin
  const isAdmin = user.roles?.some(r => r.startsWith('ah_')) || user.is_admin || false;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 99999,
      }}
      onClick={onClose}
    >
      <div
        className="ah-modal ah-modal--large"
        style={{
          position: 'fixed',
          top: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          maxHeight: 'calc(100vh - 4rem)',
          maxWidth: '90vw',
          width: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ah-modal-header ah-flex ah-flex-between">
          <h2>Settings</h2>
          <button className="ah-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div
          className="ah-modal-tabs ah-flex gap-0 border-b border-gray-200"
          style={{
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          <button
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'personal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('personal')}
          >
            Personal Settings
          </button>

          {isAdmin && (
            <>
              <button
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === 'registration'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('registration')}
              >
                App Registration
              </button>

              <button
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === 'control'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('control')}
              >
                App Control
              </button>

              <button
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('users')}
              >
                User Management
              </button>

              <button
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === 'roles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('roles')}
              >
                Role Management
              </button>
            </>
          )}
        </div>

        {/* Tab Content - Scrollable Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
          }}
        >
          {activeTab === 'personal' && (
            <PersonalSettings
              apps={apps}
              onClose={onClose}
              onSave={onSave}
            />
          )}

          {activeTab === 'registration' && isAdmin && (
            <AdminAppRegistration
              onClose={onClose}
              onSave={onSave}
            />
          )}

          {activeTab === 'control' && isAdmin && (
            <AdminAppControl
              apps={apps}
              onClose={onClose}
              onSave={onSave}
            />
          )}

          {activeTab === 'users' && isAdmin && (
            <AdminUserManagement
              onClose={onClose}
            />
          )}

          {activeTab === 'roles' && isAdmin && (
            <AdminRoleManagement
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
