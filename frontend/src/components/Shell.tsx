import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { useAwareness } from 'activity-hub-sdk';
import { useLobby } from '../hooks/useLobby';
import { useApps, buildAppUrl } from '../hooks/useApps';
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

  const handleNewChallenge = (challenge: any) => {
    setToastChallenge(challenge);
  };

  // Redirect to game (not popup - iOS Safari blocks popups from SSE handlers)
  const handleGameStart = (appId: string, gameId: string) => {
    const app = apps.find(a => a.id === appId);
    if (app) {
      const gameUrl = buildAppUrl(app, {
        userId: user.email,
        userName: user.name,
        isAdmin: user.is_admin,
        gameId,
      });
      console.log('🎮 Redirecting to game:', gameUrl);
      // Use location.href to redirect entirely - leaves the shell
      window.location.href = gameUrl;
    }
  };

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
  const handleAppClick = (appId: string) => {
    console.log('🎮 Navigating to app:', appId);
    navigate(`/app/${appId}`);
  };

  const handleDismissToast = () => {
    setToastChallenge(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shell Header */}
      <header className="ah-app-header">
        <button className="text-xl font-bold text-blue-600 hover:text-blue-700 transition" onClick={() => navigate('/lobby')}>
          Activity Hub
        </button>

        <div className="ah-flex ah-flex-center gap-4">
          {!user.is_guest && (
            <>
              <button className="ah-btn-outline ah-btn-sm" onClick={() => setShowSettings(true)} title="Settings">
                Settings
              </button>
              <button
                className="ah-btn-outline ah-btn-sm relative"
                onClick={() => setShowChallenges(!showChallenges)}
                title="Challenges"
              >
                Challenges
                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </button>
            </>
          )}
          <div className="ah-flex ah-flex-center gap-2">
            {awarenessInitialized && !user.is_guest && (
              <div className="ah-flex-center gap-1 px-2 py-1 text-sm">
                {status === 'online' && <span>🟢</span>}
                {status === 'in_game' && <span>🎮</span>}
                {status === 'away' && <span>🟡</span>}
                {status === 'offline' && <span>⚪</span>}
                {status === 'do_not_disturb' && <span>🔴</span>}
                <span className="text-xs text-gray-600 capitalize">{status}</span>
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
          <span className="font-semibold">⚠️ Impersonating {user.email}</span>
          <span className="text-sm">(Super User: {user.superUser})</span>
          <button className="ah-btn-outline ah-btn-sm ml-auto" onClick={onEndImpersonation}>
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
          <div className="flex items-center justify-center py-16">
            <div className="ah-spinner"></div>
            <p className="ml-4">Loading apps...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to={user.is_guest ? "/apps" : "/lobby"} replace />} />
            {user.is_guest ? (
              <Route
                path="/apps"
                element={
                  <div className="ah-container py-8">
                    <h2 className="text-2xl font-bold mb-2">Available Apps</h2>
                    <p className="text-gray-600 mb-6">You are in guest mode. Only public apps are accessible.</p>
                    <div className="ah-grid-auto">
                      {apps.map(app => (
                        <button key={app.id} className="ah-card hover:shadow-lg transition-shadow text-left" onClick={() => handleAppClick(app.id)}>
                          <span className="text-3xl mb-3 block">{app.icon}</span>
                          <h3 className="font-semibold mb-1">{app.name}</h3>
                          <p className="text-sm text-gray-600">{app.description}</p>
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
                <div className="ah-container py-8">
                  <h2 className="text-2xl font-bold mb-4">👤 Profile</h2>
                  <p className="text-gray-600">Profile management coming soon...</p>
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
