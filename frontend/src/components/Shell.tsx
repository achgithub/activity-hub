import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useAwareness } from 'activity-hub-sdk';
import { useLobby } from '../hooks/useLobby';
import { useApps } from '../hooks/useApps';
import Lobby from './Lobby';
import AppContainer from './AppContainer';
import ChallengeToast from './ChallengeToast';
import Settings from './Settings';
import ChallengesOverlay from './ChallengesOverlay';

interface ShellProps {
  user: User;
  onLogout: () => void;
  onEndImpersonation: () => void;
}

const Shell: React.FC<ShellProps> = ({ user, onLogout, onEndImpersonation }) => {
  const navigate = useNavigate();
  const [toastChallenge, setToastChallenge] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);

  // Debug: Log user info
  console.log('🔍 Shell received user:', user);

  // Initialize awareness (presence tracking)
  const { status, isInitialized: awarenessInitialized } = useAwareness(user.email, user.name);

  // Fetch apps from registry
  const { apps, loading: appsLoading, refreshApps } = useApps();

  const handleNewChallenge = useCallback((challenge: any) => {
    setToastChallenge(challenge);
  }, []);

  // Redirect to game (not popup - iOS Safari blocks popups from SSE handlers)
  const handleGameStart = useCallback((appId: string, gameId: string) => {
    console.log('🎮 Navigating to game:', appId, 'gameId:', gameId);
    // Route through AppContainer which provides the header
    navigate(`/app/${appId}?gameId=${gameId}`);
  }, [navigate]);

  const {
    onlineUsers,
    receivedChallenges,
    sentChallenges,
    sendChallenge,
    sendMultiChallenge,
    acceptChallenge,
    rejectChallenge,
    fetchGameConfig,
  } = useLobby(user.email, {
    onNewChallenge: handleNewChallenge,
    onGameStart: handleGameStart,
  });
  const notificationCount = receivedChallenges.filter(c => c.status === 'pending').length;

  // Navigate to app container (which launches the app via Unix socket)
  const handleAppClick = useCallback((appId: string, gameId?: string) => {
    console.log('🎮 Navigating to app:', appId, gameId ? `with gameId: ${gameId}` : '');
    const url = gameId ? `/app/${appId}?gameId=${gameId}` : `/app/${appId}`;
    navigate(url);
  }, [navigate]);

  const handleDismissToast = useCallback(() => {
    setToastChallenge(null);
  }, []);

  return (
    <div className="ah-screen">
      {/* Shell Header */}
      <header className="ah-app-header">
        <h1 className="ah-app-title ah-clickable" onClick={() => navigate('/lobby')}>
          Activity Hub
        </h1>

        <div className="ah-app-header-right">
          {!user.is_guest && (
            <>
              <button className="ah-btn-outline ah-btn-sm" onClick={() => setShowSettings(true)} title="Settings">
                Settings
              </button>
              <button
                className="ah-btn-outline ah-btn-sm ah-btn-with-badge"
                onClick={() => setShowChallenges(!showChallenges)}
                title="Challenges"
              >
                Challenges
                {notificationCount > 0 && (
                  <span className="ah-notification-badge">
                    {notificationCount}
                  </span>
                )}
              </button>
            </>
          )}
          <div className="ah-app-header-right">
            {awarenessInitialized && !user.is_guest && (
              <div className="ah-flex ah-flex-center">
                {status === 'online' && <span>🟢</span>}
                {status === 'in_game' && <span>🎮</span>}
                {status === 'away' && <span>🟡</span>}
                {status === 'offline' && <span>⚪</span>}
                {status === 'do_not_disturb' && <span>🔴</span>}
                <span className="ah-meta ah-capitalize ah-ml-2">{status}</span>
              </div>
            )}
            <button
              className="ah-btn-outline ah-btn-sm"
              onClick={() => navigate('/profile')}
              title="Profile"
            >
              {user.is_guest ? 'Guest' : user.email}
            </button>
            <button className="ah-btn-outline ah-btn-sm" onClick={onLogout}>
              {user.is_guest ? 'Exit' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {/* Impersonation Banner */}
      {user.impersonating && (
        <div className="ah-banner ah-banner--warning">
          <span>⚠️ Impersonating {user.email}</span>
          <span className="ah-meta">(Super User: {user.superUser})</span>
          <button className="ah-btn-outline ah-btn-sm" onClick={onEndImpersonation}>
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Guest Mode Banner */}
      {user.is_guest && (
        <div className="ah-banner ah-banner--info">
          👤 Guest Mode: Limited access to public apps only
        </div>
      )}

      {/* Challenge Toast Notification */}
      {toastChallenge && (
        <ChallengeToast
          fromUser={toastChallenge.fromUser}
          appId={toastChallenge.appId}
          onDismiss={handleDismissToast}
        />
      )}

      {/* Main Content Area */}
      <main>
        {appsLoading ? (
          <div className="ah-flex-center-justify ah-py-4">
            <div className="ah-spinner"></div>
            <p className="ah-ml-2">Loading apps...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to={user.is_guest ? "/apps" : "/lobby"} replace />} />
            {user.is_guest ? (
              <Route
                path="/apps"
                element={
                  <div className="ah-container ah-py-4">
                    <h2 className="ah-header-title">Available Apps</h2>
                    <p className="ah-meta ah-mb-3">You are in guest mode. Only public apps are accessible.</p>
                    <div className="ah-grid-auto">
                      {apps.map(app => (
                        <button key={app.id} className="ah-card ah-card-hover" onClick={() => handleAppClick(app.id)}>
                          <span className="ah-icon-xl">{app.icon}</span>
                          <h3 className="ah-card-title">{app.name}</h3>
                          <p className="ah-meta">{app.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                }
              />
            ) : (
              <Route
                path="/lobby"
                element={
                  <Lobby
                    apps={apps}
                    onAppClick={handleAppClick}
                    userEmail={user.email}
                    userName={user.name}
                    onlineUsers={onlineUsers}
                    onSendChallenge={sendChallenge}
                    onSendMultiChallenge={sendMultiChallenge}
                    fetchGameConfig={fetchGameConfig}
                  />
                }
              />
            )}
            <Route
              path="/app/:appId"
              element={<AppContainer apps={apps} user={user} />}
            />
            <Route
              path="/profile"
              element={
                <div className="ah-container ah-py-4">
                  <h2 className="ah-header-title">👤 Profile</h2>
                  <p className="ah-meta">Profile management coming soon...</p>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/lobby" replace />} />
          </Routes>
        )}
      </main>

      {/* Challenges Overlay */}
      {showChallenges && (
        <ChallengesOverlay
          receivedChallenges={receivedChallenges}
          sentChallenges={sentChallenges}
          apps={apps}
          userEmail={user.email}
          userName={user.name}
          onlineUsers={onlineUsers}
          onAccept={acceptChallenge}
          onReject={rejectChallenge}
          onClose={() => setShowChallenges(false)}
        />
      )}

      {/* Settings Modal - rendered as portal to avoid stacking context issues */}
      {showSettings && createPortal(
        <Settings
          apps={apps}
          user={user}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            refreshApps();
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default Shell;
