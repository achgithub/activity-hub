import React, { useState, useEffect } from 'react';
import { AdminUser, ActivityHubRole } from '../../types/admin';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminUserManagementProps {
  onClose: () => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onClose }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [availableRoles, setAvailableRoles] = useState<ActivityHubRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assigningRole, setAssigningRole] = useState(false);
  const [revokingRole, setRevokingRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      if (data.users && data.users.length > 0) {
        setSelectedUser(data.users[0]);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE}/admin/roles`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      const allRoles: ActivityHubRole[] = [
        ...(data.groups || []),
        ...(data.roles || []),
      ];
      setAvailableRoles(allRoles);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) {
      alert('Please select a role');
      return;
    }

    // Check if role is already assigned
    if (selectedUser.roles.includes(selectedRoleId)) {
      alert('User already has this role');
      return;
    }

    setAssigningRole(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(selectedUser.email)}/roles/${encodeURIComponent(selectedRoleId)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to assign role');
      }

      // Update selected user's roles
      setSelectedUser({
        ...selectedUser,
        roles: [...selectedUser.roles, selectedRoleId],
      });

      // Update users list
      setUsers(users.map(u =>
        u.email === selectedUser.email
          ? { ...u, roles: [...u.roles, selectedRoleId] }
          : u
      ));

      setSelectedRoleId('');
    } catch (err) {
      console.error('Failed to assign role:', err);
      alert('Failed to assign role');
    } finally {
      setAssigningRole(false);
    }
  };

  const handleRevokeRole = async (roleId: string) => {
    if (!selectedUser) return;

    setRevokingRole(roleId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(selectedUser.email)}/roles/${encodeURIComponent(roleId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke role');
      }

      // Update selected user's roles
      const updatedRoles = selectedUser.roles.filter(r => r !== roleId);
      setSelectedUser({
        ...selectedUser,
        roles: updatedRoles,
      });

      // Update users list
      setUsers(users.map(u =>
        u.email === selectedUser.email
          ? { ...u, roles: updatedRoles }
          : u
      ));
    } catch (err) {
      console.error('Failed to revoke role:', err);
      alert('Failed to revoke role');
    } finally {
      setRevokingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="ah-modal-body ah-flex ah-flex-center">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  const rolesMap = new Map(availableRoles.map(r => [r.id, r]));
  const unassignedRoles = availableRoles.filter(
    r => !selectedUser?.roles.includes(r.id)
  );

  return (
    <>
      <div className="ah-modal-body">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel: User List */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Users ({users.length})</h3>
            {users.length === 0 ? (
              <p className="text-gray-500 italic">No users found</p>
            ) : (
              <div className="ah-list max-h-96 overflow-y-auto">
                {users.map(user => (
                  <div
                    key={user.email}
                    className={`ah-list-item cursor-pointer transition ${
                      selectedUser?.email === user.email
                        ? 'bg-blue-100 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="font-medium text-sm">{user.name || user.email}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {user.roles.length} role{user.roles.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Role Management */}
          <div>
            {selectedUser ? (
              <>
                <h3 className="text-lg font-semibold mb-3">
                  Manage Roles: {selectedUser.name || selectedUser.email}
                </h3>

                {/* Assigned Roles */}
                <div className="mb-6">
                  <h4 className="font-medium text-sm text-gray-700 mb-2">
                    Assigned Roles ({selectedUser.roles.length})
                  </h4>
                  {selectedUser.roles.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No roles assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUser.roles.map(roleId => {
                        const role = rolesMap.get(roleId);
                        return (
                          <div
                            key={roleId}
                            className="ah-card ah-flex ah-flex-between items-center"
                          >
                            <div>
                              <div className="font-medium text-sm">{role?.name || roleId}</div>
                              {role?.description && (
                                <div className="text-xs text-gray-600">{role.description}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {role?.type === 'group' ? '👥 Group' : '🔑 Role'}
                              </div>
                            </div>
                            <button
                              className="ah-btn-danger ah-btn-sm"
                              onClick={() => handleRevokeRole(roleId)}
                              disabled={revokingRole === roleId}
                            >
                              {revokingRole === roleId ? 'Revoking...' : 'Revoke'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Assign New Role */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Assign New Role</h4>
                  {unassignedRoles.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      All available roles are assigned
                    </p>
                  ) : (
                    <div className="ah-flex gap-2">
                      <select
                        className="ah-select flex-1"
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                      >
                        <option value="">Select a role...</option>
                        {unassignedRoles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                            {role.type === 'group' ? ' (Group)' : ' (Role)'}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ah-btn-primary ah-btn-sm"
                        onClick={handleAssignRole}
                        disabled={!selectedRoleId || assigningRole}
                      >
                        {assigningRole ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500">Select a user to manage roles</p>
            )}
          </div>
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

export default AdminUserManagement;
