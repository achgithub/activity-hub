import React, { useState, useEffect } from 'react';
import { ActivityHubRole } from '../../types/admin';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminRoleManagementProps {
  onClose: () => void;
}

const AdminRoleManagement: React.FC<AdminRoleManagementProps> = ({ onClose }) => {
  const [roles, setRoles] = useState<ActivityHubRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'groups'>('roles');
  const [showAddRole, setShowAddRole] = useState(false);

  // Form states
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_BASE}/admin/roles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      const allRoles = [
        ...(data.groups || []).map((g: any) => ({ ...g, type: 'group' })),
        ...(data.roles || []).map((r: any) => ({ ...r, type: 'role' })),
      ];
      setRoles(allRoles);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      alert('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId || !newRoleName) {
      alert('ID and name required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: newRoleId,
          name: newRoleName,
          description: newRoleDesc,
          type: activeTab === 'groups' ? 'group' : 'role',
        }),
      });

      if (!response.ok) throw new Error('Failed to create role');

      setNewRoleId('');
      setNewRoleName('');
      setNewRoleDesc('');
      setShowAddRole(false);
      await fetchRoles();
      alert(`${activeTab === 'groups' ? 'Group' : 'Role'} created successfully`);
    } catch (err) {
      console.error('Failed to create role:', err);
      alert('Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm(`Are you sure you want to delete role "${roleId}"? This will remove it from all users.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/roles/${encodeURIComponent(roleId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete role');

      await fetchRoles();
      alert('Role deleted successfully');
    } catch (err) {
      console.error('Failed to delete role:', err);
      alert('Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="ah-modal-body ah-flex ah-flex-center">
        <p className="text-gray-500">Loading roles...</p>
      </div>
    );
  }

  const filteredRoles = roles.filter(r => r.type === (activeTab === 'groups' ? 'group' : 'role'));

  return (
    <>
      <div className="ah-modal-body">
        {/* Tabs */}
        <div className="ah-flex gap-4 border-b border-gray-200 mb-4">
          <button
            className={`pb-2 font-medium border-b-2 transition ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setActiveTab('roles');
              setShowAddRole(false);
            }}
          >
            🔑 Roles ({roles.filter(r => r.type === 'role').length})
          </button>
          <button
            className={`pb-2 font-medium border-b-2 transition ${
              activeTab === 'groups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setActiveTab('groups');
              setShowAddRole(false);
            }}
          >
            👥 Groups ({roles.filter(r => r.type === 'group').length})
          </button>
        </div>

        <div className="mb-4 ah-flex ah-flex-between">
          <h3 className="text-lg font-semibold">
            {activeTab === 'groups' ? 'Manage Groups' : 'Manage Roles'}
          </h3>
          <button
            className="ah-btn-primary ah-btn-sm"
            onClick={() => setShowAddRole(true)}
          >
            + Create {activeTab === 'groups' ? 'Group' : 'Role'}
          </button>
        </div>

        {/* Add Role/Group Form */}
        {showAddRole && (
          <div className="ah-card mb-4 bg-blue-50">
            <h4 className="font-semibold mb-3">
              Create New {activeTab === 'groups' ? 'Group' : 'Role'}
            </h4>
            <form onSubmit={handleCreateRole}>
              <div className="ah-flex-col gap-3">
                <div>
                  <label className="ah-label block mb-1">ID (system name)</label>
                  <input
                    type="text"
                    className="ah-input w-full text-sm"
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(e.target.value)}
                    placeholder={activeTab === 'groups' ? 'ah_g_admins' : 'quiz_master'}
                    required
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {activeTab === 'groups' ? 'Groups: ah_g_* prefix' : 'Roles: custom naming'}
                  </p>
                </div>
                <div>
                  <label className="ah-label block mb-1">Display Name</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder={activeTab === 'groups' ? 'Admin Group' : 'Quiz Master'}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="ah-label block mb-1">Description (optional)</label>
                  <textarea
                    className="ah-input w-full"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder="What permissions does this role provide?"
                    rows={2}
                    disabled={submitting}
                  />
                </div>
                <div className="ah-flex gap-2">
                  <button
                    type="submit"
                    className="ah-btn-primary ah-btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    className="ah-btn-outline ah-btn-sm"
                    onClick={() => {
                      setShowAddRole(false);
                      setNewRoleId('');
                      setNewRoleName('');
                      setNewRoleDesc('');
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Roles/Groups Table */}
        {filteredRoles.length === 0 ? (
          <p className="text-gray-500 italic">
            No {activeTab === 'groups' ? 'groups' : 'roles'} found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ah-html-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map(role => (
                  <tr key={role.id}>
                    <td>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{role.id}</code>
                    </td>
                    <td className="font-medium">{role.name}</td>
                    <td className="text-sm text-gray-600">
                      {role.description || '-'}
                    </td>
                    <td>
                      <button
                        className="ah-btn-danger ah-btn-sm"
                        onClick={() => handleDeleteRole(role.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">ℹ️ About Roles & Groups</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Groups</strong> (ah_g_*): Use for broad permissions (admin, super_user)</li>
            <li>• <strong>Roles</strong>: Use for specific app permissions (chess:player, quiz_master)</li>
            <li>• Assign multiple roles to a single user via User Management tab</li>
            <li>• Groups should use ah_g_ prefix for consistency</li>
          </ul>
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
};

export default AdminRoleManagement;
