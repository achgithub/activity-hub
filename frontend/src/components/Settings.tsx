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
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
      <div className="ah-modal ah-modal--large fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50" onClick={(e) => e.stopPropagation()}>
        <div className="ah-modal-header ah-flex ah-flex-between">
          <h2>Settings</h2>
          <button className="ah-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="ah-modal-tabs ah-flex gap-0 border-b border-gray-200">
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

        {/* Tab Content */}
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
  );
};

export default Settings;
