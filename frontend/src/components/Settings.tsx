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
  const [editApp, setEditApp] = useState<any | null>(null);

  // Check if user is admin
  const isAdmin = user.roles?.some(r => r.startsWith('ah_')) || user.is_admin || false;

  const handleEditApp = (app: any) => {
    setEditApp(app);
    setActiveTab('registration');
  };

  const handleCloseRegistration = () => {
    setEditApp(null);
    onClose();
  };

  const handleSaveRegistration = () => {
    setEditApp(null);
    onSave();
  };

  return (
    <div
      className="ah-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ah-modal ah-modal--large ah-modal--settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ah-modal-header ah-flex ah-flex-between">
          <h2>Settings</h2>
          <button className="ah-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div
          className="ah-modal-tabs ah-flex gap-0 border-b border-gray-200"
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
        <div className="ah-modal-content-scroll">
          {activeTab === 'personal' && (
            <PersonalSettings
              apps={apps}
              onClose={onClose}
              onSave={onSave}
            />
          )}

          {activeTab === 'registration' && isAdmin && (
            <AdminAppRegistration
              onClose={handleCloseRegistration}
              onSave={handleSaveRegistration}
              editApp={editApp}
            />
          )}

          {activeTab === 'control' && isAdmin && (
            <AdminAppControl
              apps={apps}
              onClose={onClose}
              onSave={onSave}
              onEditApp={handleEditApp}
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
