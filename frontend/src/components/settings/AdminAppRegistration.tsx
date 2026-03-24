import React, { useState } from 'react';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface AdminAppRegistrationProps {
  onClose: () => void;
  onSave: () => void;
  editApp?: {
    id: string;
    name: string;
    icon: string;
    category: string;
    description: string;
    realtime: string;
    minPlayers?: number;
    maxPlayers?: number;
    binaryPath?: string;
    staticPath?: string;
    guestAccessible?: boolean;
    displayOrder?: number;
    requiredRoles?: string[];
  } | null;
}

interface Role {
  id: string;
  label: string;
  description: string;
  isDefault?: boolean;
  isRestricted?: boolean;
}

const AdminAppRegistration: React.FC<AdminAppRegistrationProps> = ({ onClose, onSave, editApp }) => {
  const isEditMode = !!editApp;

  const [formData, setFormData] = useState({
    id: editApp?.id || '',
    name: editApp?.name || '',
    icon: editApp?.icon || '',
    category: editApp?.category || 'game',
    description: editApp?.description || '',
    realtime: editApp?.realtime || 'none',
    minPlayers: editApp?.minPlayers || 1,
    maxPlayers: editApp?.maxPlayers,
    binaryPath: editApp?.binaryPath || '',
    staticPath: editApp?.staticPath || '',
    guestAccessible: editApp?.guestAccessible ?? true,
    displayOrder: editApp?.displayOrder || 999,
  });

  const [roles, setRoles] = useState<Role[]>([
    { id: 'player', label: 'Player', description: 'Can play the game', isDefault: true },
  ]);

  const [requiredRolesInput, setRequiredRolesInput] = useState(
    editApp?.requiredRoles?.join(', ') || ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'minPlayers' || name === 'maxPlayers') {
      setFormData(prev => ({
        ...prev,
        [name]: value ? parseInt(value) : undefined
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddRole = () => {
    setRoles(prev => [...prev, { id: '', label: '', description: '' }]);
  };

  const handleRemoveRole = (index: number) => {
    setRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRoleChange = (index: number, field: string, value: string | boolean) => {
    setRoles(prev =>
      prev.map((role, i) =>
        i === index ? { ...role, [field]: value } : role
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Parse required roles from comma-separated string
      const requiredRoles = requiredRolesInput
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      const payload = {
        ...formData,
        requiredRoles,
        roles: roles.map(r => ({
          id: r.id,
          label: r.label,
          description: r.description,
          isDefault: r.isDefault || false,
          isRestricted: r.isRestricted || false,
        })),
      };

      const url = isEditMode
        ? `${API_BASE}/admin/apps/${formData.id}`
        : `${API_BASE}/admin/apps/register`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEditMode ? 'update' : 'register'} app`);
      }

      alert(`App ${isEditMode ? 'updated' : 'registered'} successfully!`);

      if (!isEditMode) {
        // Reset form only for new registrations
        setFormData({
          id: '',
          name: '',
          icon: '',
          category: 'game',
          description: '',
          realtime: 'none',
          minPlayers: 1,
          maxPlayers: undefined,
          binaryPath: '',
          staticPath: '',
          guestAccessible: true,
          displayOrder: 999,
        });
        setRoles([{ id: 'player', label: 'Player', description: 'Can play the game', isDefault: true }]);
        setRequiredRolesInput('');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="ah-modal-body">
        <p className="text-gray-600 mb-6">
          {isEditMode
            ? 'Edit the app details and roles. App ID cannot be changed.'
            : 'Register a new mini-app by filling in the app details and defining its roles.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* App Details */}
          <div className="border-b pb-6">
            <h3 className="font-semibold mb-4">App Details</h3>

            <div className="ah-flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">App ID *</label>
                <input
                  type="text"
                  name="id"
                  className="ah-input w-full"
                  placeholder="chess, racing, leaderboard"
                  value={formData.id}
                  onChange={handleInputChange}
                  disabled={isEditMode}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Icon *</label>
                <input
                  type="text"
                  name="icon"
                  className="ah-input w-full"
                  placeholder="♟️ 🏎️ 📊"
                  value={formData.icon}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">App Name *</label>
              <input
                type="text"
                name="name"
                className="ah-input w-full"
                placeholder="Chess Master"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                name="description"
                className="ah-input w-full"
                placeholder="What does this app do?"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            <div className="ah-flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Category *</label>
                <select
                  name="category"
                  className="ah-select w-full"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  <option value="game">Game</option>
                  <option value="utility">Utility</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Real-time Type</label>
                <select
                  name="realtime"
                  className="ah-select w-full"
                  value={formData.realtime}
                  onChange={handleInputChange}
                >
                  <option value="none">None</option>
                  <option value="sse">Server-Sent Events</option>
                  <option value="websocket">WebSocket</option>
                </select>
              </div>
            </div>

            {formData.category === 'game' && (
              <div className="ah-flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Min Players</label>
                  <input
                    type="number"
                    name="minPlayers"
                    className="ah-input w-full"
                    value={formData.minPlayers || ''}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Max Players</label>
                  <input
                    type="number"
                    name="maxPlayers"
                    className="ah-input w-full"
                    placeholder="Leave blank for unlimited"
                    value={formData.maxPlayers || ''}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Binary Path *</label>
              <input
                type="text"
                name="binaryPath"
                className="ah-input w-full"
                placeholder="/home/andrew/activity-hub-chess/backend/chess-app"
                value={formData.binaryPath}
                onChange={handleInputChange}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Full path to the app's executable binary</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Static Path *</label>
              <input
                type="text"
                name="staticPath"
                className="ah-input w-full"
                placeholder="/home/andrew/activity-hub-chess/frontend/build"
                value={formData.staticPath}
                onChange={handleInputChange}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Full path to the app's static files (HTML/JS/CSS)</p>
            </div>

            <div className="ah-flex gap-4 mt-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Display Order</label>
                <input
                  type="number"
                  name="displayOrder"
                  className="ah-input w-full"
                  value={formData.displayOrder}
                  onChange={handleInputChange}
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first (default: 999)</p>
              </div>
              <div className="flex-1 flex items-center">
                <label className="ah-flex ah-flex-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="guestAccessible"
                    checked={formData.guestAccessible}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, guestAccessible: e.target.checked }))
                    }
                  />
                  <span className="text-sm font-medium">Guest Accessible</span>
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Required Roles (Optional)</label>
              <input
                type="text"
                className="ah-input w-full"
                placeholder="ah_g_admin, chess:premium (comma-separated)"
                value={requiredRolesInput}
                onChange={(e) => setRequiredRolesInput(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Users must have ONE of these roles to access the app. Leave blank for no restrictions.
              </p>
            </div>
          </div>

          {/* Roles */}
          <div className="border-b pb-6">
            <div className="ah-flex ah-flex-between mb-4">
              <h3 className="font-semibold">Roles</h3>
              <button
                type="button"
                className="ah-btn-outline ah-btn-sm"
                onClick={handleAddRole}
              >
                + Add Role
              </button>
            </div>

            <div className="space-y-4">
              {roles.map((role, index) => (
                <div key={index} className="border rounded p-4 bg-gray-50">
                  <div className="ah-flex gap-4 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2">Role ID *</label>
                      <input
                        type="text"
                        className="ah-input w-full"
                        placeholder="player, admin, guest"
                        value={role.id}
                        onChange={(e) => handleRoleChange(index, 'id', e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2">Display Label *</label>
                      <input
                        type="text"
                        className="ah-input w-full"
                        placeholder="Player, Administrator"
                        value={role.label}
                        onChange={(e) => handleRoleChange(index, 'label', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <input
                      type="text"
                      className="ah-input w-full"
                      placeholder="What can users with this role do?"
                      value={role.description}
                      onChange={(e) => handleRoleChange(index, 'description', e.target.value)}
                    />
                  </div>

                  <div className="ah-flex gap-4 items-center">
                    <label className="ah-flex ah-flex-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={role.isDefault || false}
                        onChange={(e) => handleRoleChange(index, 'isDefault', e.target.checked)}
                      />
                      <span className="text-sm">Assign to all users by default</span>
                    </label>

                    <label className="ah-flex ah-flex-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={role.isRestricted || false}
                        onChange={(e) => handleRoleChange(index, 'isRestricted', e.target.checked)}
                      />
                      <span className="text-sm">Admin-only (can't self-assign)</span>
                    </label>

                    {index > 0 && (
                      <button
                        type="button"
                        className="ah-btn-danger ah-btn-sm ml-auto"
                        onClick={() => handleRemoveRole(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>

      <div className="ah-modal-footer ah-flex ah-flex-between">
        <div />
        <div className="ah-flex gap-2">
          <button className="ah-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ah-btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? (isEditMode ? 'Updating...' : 'Registering...')
              : (isEditMode ? 'Update App' : 'Register App')}
          </button>
        </div>
      </div>
    </>
  );
};

export default AdminAppRegistration;
