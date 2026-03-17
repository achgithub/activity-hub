import React, { useState, useEffect } from 'react';
import { AppDefinition, UserPresence, ChallengeOptions, GameConfig } from '@activity-hub/core';
import ChallengeModal from './ChallengeModal';
import MultiPlayerChallengeModal from './MultiPlayerChallengeModal';
import GameChallengeModal from './GameChallengeModal';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
  userEmail: string;
  userName: string;
  onlineUsers: UserPresence[];
  onSendChallenge: (toUser: string, appId: string, options?: ChallengeOptions) => Promise<boolean>;
  onSendMultiChallenge: (playerIds: string[], appId: string, minPlayers: number, maxPlayers: number, options?: ChallengeOptions) => Promise<boolean>;
  fetchGameConfig: (appId: string) => Promise<GameConfig | null>;
}

interface AppPreference {
  appId: string;
  isHidden: boolean;
  isFavorite: boolean;
  customOrder: number | null;
}

const API_BASE = `http://${window.location.hostname}:3001/api`;

const Lobby: React.FC<LobbyProps> = ({
  apps,
  onAppClick,
  userEmail,
  userName,
  onlineUsers,
  onSendChallenge,
  onSendMultiChallenge,
  fetchGameConfig,
}) => {
  // Online users overlay state
  const [showOnlineUsersOverlay, setShowOnlineUsersOverlay] = useState(false);

  // User preferences (favorite/block) - stored in local state for now
  const [favoriteUsers, setFavoriteUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // Favorite apps - fetched from database
  const [favoriteAppIds, setFavoriteAppIds] = useState<Set<string>>(new Set());
  const [appPreferences, setAppPreferences] = useState<AppPreference[]>([]);

  // Appear offline toggle
  const [appearOffline, setAppearOffline] = useState(false);

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Fetch app preferences (including favorites) on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/user/preferences`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.preferences) {
          setAppPreferences(data.preferences);
          // Extract favorite app IDs
          const favorites = new Set<string>(
            data.preferences
              .filter((pref: AppPreference) => pref.isFavorite)
              .map((pref: AppPreference) => pref.appId)
          );
          setFavoriteAppIds(favorites);
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      }
    };

    fetchPreferences();
  }, []);

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const toggleFavorite = (email: string) => {
    const newFavorites = new Set(favoriteUsers);
    if (newFavorites.has(email)) {
      newFavorites.delete(email);
    } else {
      newFavorites.add(email);
      // Remove from blocked if favoriting
      const newBlocked = new Set(blockedUsers);
      newBlocked.delete(email);
      setBlockedUsers(newBlocked);
    }
    setFavoriteUsers(newFavorites);
  };

  const toggleBlock = (email: string) => {
    const newBlocked = new Set(blockedUsers);
    if (newBlocked.has(email)) {
      newBlocked.delete(email);
    } else {
      newBlocked.add(email);
      // Remove from favorites if blocking
      const newFavorites = new Set(favoriteUsers);
      newFavorites.delete(email);
      setFavoriteUsers(newFavorites);
    }
    setBlockedUsers(newBlocked);
  };

  const toggleFavoriteApp = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the app

    const isFavorite = favoriteAppIds.has(appId);
    const newFavorites = new Set(favoriteAppIds);

    if (isFavorite) {
      newFavorites.delete(appId);
    } else {
      newFavorites.add(appId);
    }

    // Update local state immediately for responsive UI
    setFavoriteAppIds(newFavorites);

    // Save to database
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Build updated preferences array
      const updatedPreferences = apps
        .filter(app => app.id !== 'lobby')
        .map((app) => {
          const existing = appPreferences.find(p => p.appId === app.id);
          return {
            appId: app.id,
            isHidden: existing?.isHidden || false,
            isFavorite: app.id === appId ? !isFavorite : (existing?.isFavorite || false),
            customOrder: existing?.customOrder !== null && existing?.customOrder !== undefined
              ? existing.customOrder
              : (app.displayOrder ?? null)
          };
        });

      const response = await fetch(`${API_BASE}/user/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferences: updatedPreferences })
      });

      if (response.ok) {
        setAppPreferences(updatedPreferences);
      } else {
        console.error('Failed to save favorite preference');
        // Revert on failure
        setFavoriteAppIds(favoriteAppIds);
      }
    } catch (error) {
      console.error('Failed to save favorite:', error);
      // Revert on failure
      setFavoriteAppIds(favoriteAppIds);
    }
  };

  // Challenge modal state - now starts with game selection
  const [challengeModal, setChallengeModal] = useState<{
    targetUser: string;
  } | null>(null);

  // Multi-player challenge modal state
  const [multiPlayerModalOpen, setMultiPlayerModalOpen] = useState(false);

  // New challenge flow modal state - starts with game, then selects users
  const [newChallengeModal, setNewChallengeModal] = useState<{
    app: AppDefinition;
  } | null>(null);

  // Get challengeable games (category: game, has realtime support)
  const challengeableApps = apps.filter(app =>
    app.category === 'game' &&
    app.realtime &&
    app.realtime !== 'none'
  );

  // Split into 2-player and multi-player apps
  const twoPlayerApps = challengeableApps.filter(app =>
    !app.minPlayers || app.minPlayers <= 2
  );

  const multiPlayerApps = challengeableApps.filter(app =>
    app.minPlayers && app.minPlayers > 2
  );

  // Filter out lobby itself from the grid
  const availableApps = apps.filter(app => app.id !== 'lobby');

  // Group apps by category
  const favoriteApps = availableApps.filter(app => favoriteAppIds.has(app.id));
  const gameApps = availableApps.filter(app => app.category === 'game');
  const utilityApps = availableApps.filter(app => app.category === 'utility');
  const adminApps = availableApps.filter(app => app.category === 'admin');

  // Send challenge from modal (appId now comes from modal)
  const handleConfirmChallenge = async (appId: string, options: ChallengeOptions) => {
    if (challengeModal) {
      await onSendChallenge(challengeModal.targetUser, appId, options);
      setChallengeModal(null);
    }
  };

  // Send multi-player challenge from modal
  const handleConfirmMultiChallenge = async (appId: string, playerIds: string[], options: ChallengeOptions) => {
    const app = apps.find(a => a.id === appId);
    const minPlayers = app?.minPlayers || playerIds.length;
    const maxPlayers = app?.maxPlayers || playerIds.length;

    await onSendMultiChallenge(playerIds, appId, minPlayers, maxPlayers, options);
    setMultiPlayerModalOpen(false);
  };

  // Handle new challenge flow confirmation
  const handleNewChallengeConfirm = async (appId: string, playerIds: string[], options: ChallengeOptions) => {
    const app = apps.find(a => a.id === appId);
    const isGroupGame = app?.minPlayers && app.minPlayers > 2;

    // Solo play - create game with options, then launch
    if (playerIds.length === 0) {
      setNewChallengeModal(null);

      // Create game via Unix socket proxy
      try {
        const token = localStorage.getItem('token');
        if (!token || !app) {
          onAppClick(appId);
          return;
        }

        const response = await fetch(`/api/apps/${appId}/proxy/api/game?userId=${userEmail}&userName=${encodeURIComponent(userName)}&token=${token}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-User-ID': userEmail,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: options.mode || 'colors',
            variant: '1player',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Launch app with gameId (use gameId from response, or game.id as fallback)
          const gameId = result.gameId || result.game?.id || result.id;
          const appUrl = `/api/apps/${appId}/proxy?gameId=${gameId}&userId=${userEmail}&userName=${encodeURIComponent(userName)}&token=${token}`;
          window.location.href = appUrl;
        } else {
          // Fallback: just launch app
          onAppClick(appId);
        }
      } catch (error) {
        console.error('Failed to create solo game:', error);
        onAppClick(appId);
      }
      return;
    }

    if (isGroupGame) {
      // Multi-player challenge
      const minPlayers = app?.minPlayers || playerIds.length;
      const maxPlayers = app?.maxPlayers || playerIds.length;
      await onSendMultiChallenge(playerIds, appId, minPlayers, maxPlayers, options);
    } else {
      // 1v1 challenge (take first player)
      await onSendChallenge(playerIds[0], appId, options);
    }

    setNewChallengeModal(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="ah-app-header">
        <h1>Game Lobby</h1>

        {/* User status and online users button */}
        <div className="ah-flex ah-flex-center gap-4">
          <div className="ah-flex ah-flex-center gap-2">
            <span className={`w-3 h-3 rounded-full ${appearOffline ? 'bg-gray-400' : 'bg-green-500'}`}></span>
            <span className="font-medium">{userName}</span>
            <button
              className={`ah-btn-outline ah-btn-sm ${appearOffline ? 'opacity-60' : ''}`}
              onClick={() => setAppearOffline(!appearOffline)}
              title={appearOffline ? 'Appear online' : 'Appear offline'}
            >
              {appearOffline ? 'Offline' : 'Online'}
            </button>
          </div>

          {onlineUsers.length > 0 && (
            <button
              className="ah-btn-outline ah-btn-sm"
              onClick={() => setShowOnlineUsersOverlay(!showOnlineUsersOverlay)}
            >
              {onlineUsers.length} online
            </button>
          )}
        </div>
      </div>

      {/* Online Users Floating Overlay */}
      {showOnlineUsersOverlay && (
        <>
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowOnlineUsersOverlay(false)}
          />
          <div className="ah-modal ah-modal--large fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="ah-modal-header ah-flex ah-flex-between">
              <h3>Online Users ({onlineUsers.length})</h3>
              <button
                className="ah-modal-close"
                onClick={() => setShowOnlineUsersOverlay(false)}
              >
                ✕
              </button>
            </div>
            <div className="ah-modal-body">
              <div className="ah-list">
                {onlineUsers.map((user) => (
                  <div key={user.email} className="ah-list-item ah-flex ah-flex-between">
                    <div className="ah-flex ah-flex-center gap-3 flex-1">
                      <span className={`w-3 h-3 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span className="font-medium">{user.displayName}</span>
                      {user.currentApp && (
                        <span className="text-sm text-gray-500">in {user.currentApp}</span>
                      )}
                    </div>
                    <div className="ah-flex gap-2">
                      <button
                        className="ah-btn-outline ah-btn-sm"
                        onClick={() => toggleFavorite(user.email)}
                        title={favoriteUsers.has(user.email) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {favoriteUsers.has(user.email) ? '★' : '☆'}
                      </button>
                      <button
                        className="ah-btn-outline ah-btn-sm"
                        onClick={() => toggleBlock(user.email)}
                        title={blockedUsers.has(user.email) ? 'Unblock' : 'Block'}
                      >
                        {blockedUsers.has(user.email) ? '🚫' : '○'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="ah-container">
        {/* Available Apps Section */}
        <section className="py-6">
          {/* Favorites Section - Always show */}
          <div className="ah-section">
            <div className="ah-section-header" onClick={() => toggleSection('favorites')}>
              <h3 className="ah-section-title">Favorites</h3>
              <span className={`ah-section-toggle ${collapsedSections.has('favorites') ? 'collapsed' : ''}`}>
                ▼
              </span>
            </div>
            <div className={`ah-section-content ${collapsedSections.has('favorites') ? 'collapsed' : ''}`}>
              {favoriteApps.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-medium">No favorite apps yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Star apps to see them first here
                  </p>
                </div>
              ) : (
                <div className="ah-grid-auto">
                  {favoriteApps.map((app) => {
                    const isChallengeable = challengeableApps.some(ca => ca.id === app.id);
                    return (
                      <button
                        key={app.id}
                        className="ah-card hover:shadow-lg transition-shadow text-left"
                        onClick={() => {
                          if (isChallengeable) {
                            setNewChallengeModal({ app });
                          } else {
                            onAppClick(app.id);
                          }
                        }}
                      >
                        <div className="ah-flex ah-flex-between mb-3">
                          <span className="text-2xl">{app.icon}</span>
                          <button
                            className="ah-btn-outline ah-btn-sm"
                            onClick={(e) => toggleFavoriteApp(app.id, e)}
                            title={favoriteAppIds.has(app.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {favoriteAppIds.has(app.id) ? '★' : '☆'}
                          </button>
                        </div>
                        <h3 className="font-semibold mb-1">{app.name}</h3>
                        <p className="text-sm text-gray-600">{app.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Games Section */}
          {gameApps.length > 0 && (
            <div className="ah-section">
              <div className="ah-section-header" onClick={() => toggleSection('games')}>
                <h3 className="ah-section-title">Games</h3>
                <span className={`ah-section-toggle ${collapsedSections.has('games') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`ah-section-content ${collapsedSections.has('games') ? 'collapsed' : ''}`}>
                <div className="ah-grid-auto">
                  {gameApps.map((app) => {
                    const isChallengeable = challengeableApps.some(ca => ca.id === app.id);
                    return (
                      <button
                        key={app.id}
                        className="ah-card hover:shadow-lg transition-shadow text-left"
                        onClick={() => {
                          if (isChallengeable) {
                            setNewChallengeModal({ app });
                          } else {
                            onAppClick(app.id);
                          }
                        }}
                      >
                        <div className="ah-flex ah-flex-between mb-3">
                          <span className="text-2xl">{app.icon}</span>
                          <button
                            className="ah-btn-outline ah-btn-sm"
                            onClick={(e) => toggleFavoriteApp(app.id, e)}
                            title={favoriteAppIds.has(app.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {favoriteAppIds.has(app.id) ? '★' : '☆'}
                          </button>
                        </div>
                        <h3 className="font-semibold mb-1">{app.name}</h3>
                        <p className="text-sm text-gray-600">{app.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Utility Section */}
          {utilityApps.length > 0 && (
            <div className="ah-section">
              <div className="ah-section-header" onClick={() => toggleSection('utility')}>
                <h3 className="ah-section-title">Utility</h3>
                <span className={`ah-section-toggle ${collapsedSections.has('utility') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`ah-section-content ${collapsedSections.has('utility') ? 'collapsed' : ''}`}>
                <div className="ah-grid-auto">
                  {utilityApps.map((app) => (
                    <button
                      key={app.id}
                      className="ah-card hover:shadow-lg transition-shadow text-left"
                      onClick={() => onAppClick(app.id)}
                    >
                      <div className="ah-flex ah-flex-between mb-3">
                        <span className="text-2xl">{app.icon}</span>
                        <button
                          className="ah-btn-outline ah-btn-sm"
                          onClick={(e) => toggleFavoriteApp(app.id, e)}
                          title={favoriteAppIds.has(app.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {favoriteAppIds.has(app.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <h3 className="font-semibold mb-1">{app.name}</h3>
                      <p className="text-sm text-gray-600">{app.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Admin Section */}
          {adminApps.length > 0 && (
            <div className="ah-section">
              <div className="ah-section-header" onClick={() => toggleSection('admin')}>
                <h3 className="ah-section-title">Admin</h3>
                <span className={`ah-section-toggle ${collapsedSections.has('admin') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`ah-section-content ${collapsedSections.has('admin') ? 'collapsed' : ''}`}>
                <div className="ah-grid-auto">
                  {adminApps.map((app) => (
                    <button
                      key={app.id}
                      className="ah-card hover:shadow-lg transition-shadow text-left"
                      onClick={() => onAppClick(app.id)}
                    >
                      <div className="ah-flex ah-flex-between mb-3">
                        <span className="text-2xl">{app.icon}</span>
                        <button
                          className="ah-btn-outline ah-btn-sm"
                          onClick={(e) => toggleFavoriteApp(app.id, e)}
                          title={favoriteAppIds.has(app.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {favoriteAppIds.has(app.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <h3 className="font-semibold mb-1">{app.name}</h3>
                      <p className="text-sm text-gray-600">{app.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Challenge Modal (2-player) */}
      {challengeModal && (
        <ChallengeModal
          targetUser={challengeModal.targetUser}
          challengeableApps={twoPlayerApps}
          onConfirm={handleConfirmChallenge}
          onCancel={() => setChallengeModal(null)}
          fetchGameConfig={fetchGameConfig}
        />
      )}

      {/* Multi-Player Challenge Modal */}
      {multiPlayerModalOpen && (
        <MultiPlayerChallengeModal
          currentUser={{ email: userEmail, displayName: userName, status: 'online' }}
          onlineUsers={onlineUsers}
          multiPlayerApps={multiPlayerApps}
          onConfirm={handleConfirmMultiChallenge}
          onCancel={() => setMultiPlayerModalOpen(false)}
          fetchGameConfig={fetchGameConfig}
        />
      )}

      {/* New Game Challenge Modal */}
      {newChallengeModal && (
        <GameChallengeModal
          app={newChallengeModal.app}
          currentUserEmail={userEmail}
          onlineUsers={onlineUsers}
          favoriteUsers={favoriteUsers}
          onConfirm={handleNewChallengeConfirm}
          onCancel={() => setNewChallengeModal(null)}
          fetchGameConfig={fetchGameConfig}
        />
      )}
    </div>
  );
};

export default Lobby;
