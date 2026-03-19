import React, { useState, useEffect } from 'react';
import { AdminUser, ActivityHubRole } from '../../types/admin';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminUserManagementProps {
  onClose: () => void;
}

interface RoleChipsProps {
  roles: string[];
  onRemoveRole: (roleId: string) => void;
  disabled: boolean;
}

function RoleChips({ roles, onRemoveRole, disabled }: RoleChipsProps) {
  if (roles.length === 0) {
    return <span className="text-gray-500 text-sm italic">No roles</span>;
  }

  return (
    <div className="ah-role-chips">
      {roles.map(roleId => (
        <button
          key={roleId}
          className="ah-role-chip active"
          onClick={() => onRemoveRole(roleId)}
          disabled={disabled}
          title={`Remove ${roleId}`}
        >
          ✓ {roleId}
        </button>
      ))}
    </div>
  );
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onClose }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [availableRoles, setAvailableRoles] = useState<ActivityHubRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null);

  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetPasswordNew, setResetPasswordNew] = useState('');
  const [selectedUserForRole, setSelectedUserForRole] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
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
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_BASE}/admin/roles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      const allRoles = [...(data.groups || []), ...(data.roles || [])];
      setAvailableRoles(allRoles);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      alert('Email and password required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || newUserEmail,
          password: newUserPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }

      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setShowAddUser(false);
      await fetchUsers();
      alert('User created successfully');
    } catch (err) {
      console.error('Failed to create user:', err);
      alert(`Failed to create user: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordNew) {
      alert('New password required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(resetPasswordEmail)}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPassword: resetPasswordNew }),
        }
      );

      if (!response.ok) throw new Error('Failed to reset password');

      setResetPasswordEmail('');
      setResetPasswordNew('');
      setShowResetPassword(null);
      alert('Password reset successfully');
    } catch (err) {
      console.error('Failed to reset password:', err);
      alert('Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignRole = async (userEmail: string, roleId: string) => {
    if (!roleId) return;

    const user = users.find(u => u.email === userEmail);
    if (user?.roles.includes(roleId)) {
      alert('User already has this role');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userEmail)}/roles/${encodeURIComponent(roleId)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to assign role');

      setUsers(users.map(u =>
        u.email === userEmail
          ? { ...u, roles: [...u.roles, roleId] }
          : u
      ));
      setSelectedUserForRole(null);
      setSelectedRoleId('');
    } catch (err) {
      console.error('Failed to assign role:', err);
      alert('Failed to assign role');
    }
  };

  const handleRevokeRole = async (userEmail: string, roleId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userEmail)}/roles/${encodeURIComponent(roleId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to revoke role');

      setUsers(users.map(u =>
        u.email === userEmail
          ? { ...u, roles: u.roles.filter(r => r !== roleId) }
          : u
      ));
    } catch (err) {
      console.error('Failed to revoke role:', err);
      alert('Failed to revoke role');
    }
  };

  if (loading) {
    return (
      <div className="ah-modal-body ah-flex ah-flex-center">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  const unassignedRoles = availableRoles.filter(
    r => !selectedUserForRole ? true : !users.find(u => u.email === selectedUserForRole)?.roles.includes(r.id)
  );

  return (
    <>
      <div className="ah-modal-body">
        <div className="mb-4 ah-flex ah-flex-between">
          <h3 className="text-lg font-semibold">User Management ({users.length})</h3>
          <button className="ah-btn-primary ah-btn-sm" onClick={() => setShowAddUser(true)}>
            + Add User
          </button>
        </div>

        {/* Add User Form */}
        {showAddUser && (
          <div className="ah-card mb-4 bg-blue-50">
            <h4 className="font-semibold mb-3">Create New User</h4>
            <form onSubmit={handleCreateUser}>
              <div className="ah-flex-col gap-3">
                <div>
                  <label className="ah-label block mb-1">Email</label>
                  <input
                    type="email"
                    className="ah-input w-full"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="ah-label block mb-1">Name (optional)</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="ah-label block mb-1">Password</label>
                  <input
                    type="password"
                    className="ah-input w-full"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="ah-flex gap-2">
                  <button
                    type="submit"
                    className="ah-btn-primary ah-btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    className="ah-btn-outline ah-btn-sm"
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUserEmail('');
                      setNewUserName('');
                      setNewUserPassword('');
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

        {/* Users Table */}
        {users.length === 0 ? (
          <p className="text-gray-500 italic">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ah-html-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Roles</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.name || '-'}</td>
                    <td>
                      <RoleChips
                        roles={user.roles}
                        onRemoveRole={(roleId) => handleRevokeRole(user.email, roleId)}
                        disabled={false}
                      />
                    </td>
                    <td>
                      <div className="ah-flex gap-1">
                        {selectedUserForRole === user.email ? (
                          <div className="ah-flex gap-1">
                            <select
                              className="ah-select text-xs"
                              value={selectedRoleId}
                              onChange={(e) => setSelectedRoleId(e.target.value)}
                            >
                              <option value="">Select role...</option>
                              {unassignedRoles.map(role => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="ah-btn-primary ah-btn-sm text-xs"
                              onClick={() => {
                                if (selectedRoleId) {
                                  handleAssignRole(user.email, selectedRoleId);
                                }
                              }}
                            >
                              Assign
                            </button>
                            <button
                              className="ah-btn-outline ah-btn-sm text-xs"
                              onClick={() => {
                                setSelectedUserForRole(null);
                                setSelectedRoleId('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="ah-btn-outline ah-btn-sm text-xs"
                              onClick={() => setSelectedUserForRole(user.email)}
                            >
                              + Add Role
                            </button>
                            <button
                              className="ah-btn-outline ah-btn-sm text-xs"
                              onClick={() => {
                                setShowResetPassword(user.email);
                                setResetPasswordEmail(user.email);
                              }}
                            >
                              Reset Pass
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowResetPassword(null)}>
            <div className="ah-modal bg-white rounded-lg p-6 max-w-sm z-[60]" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-semibold mb-4">Reset Password: {showResetPassword}</h4>
              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label className="ah-label block mb-1">New Password</label>
                  <input
                    type="password"
                    className="ah-input w-full"
                    value={resetPasswordNew}
                    onChange={(e) => setResetPasswordNew(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="ah-flex gap-2 justify-end">
                  <button
                    type="button"
                    className="ah-btn-outline ah-btn-sm"
                    onClick={() => {
                      setShowResetPassword(null);
                      setResetPasswordNew('');
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ah-btn-primary ah-btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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

export default AdminUserManagement;
