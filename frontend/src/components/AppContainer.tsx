import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppDefinition, User } from '@activity-hub/core';
import { buildAppUrl } from '../hooks/useApps';

interface AppContainerProps {
  apps: AppDefinition[];
  user: User;
}

const AppContainer: React.FC<AppContainerProps> = ({ apps, user }) => {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get gameId from URL if present (for challenge-based games)
  const gameId = searchParams.get('gameId') || undefined;

  const app = apps.find((a) => a.id === appId);

  // Listen for messages from iframe apps (e.g., "close app" requests)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin if needed (for now, accept all)
      if (event.data && event.data.type === 'CLOSE_APP') {
        console.log('Received CLOSE_APP message from iframe, returning to lobby');
        navigate('/lobby');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  if (!app) {
    return (
      <div className="ah-flex-col-center-justify min-h-screen ah-container">
        <h2>App Not Found</h2>
        <p className="ah-meta">The requested app "{appId}" could not be found.</p>
        <button className="ah-btn-primary" onClick={() => navigate('/lobby')}>Return to Lobby</button>
      </div>
    );
  }

  // Build the iframe URL with user context
  const iframeUrl = app.type === 'iframe' && app.url
    ? buildAppUrl(app, {
        userId: user.email,
        userName: user.name,
        isAdmin: user.is_admin,
        gameId,
      })
    : null;

  // Debug: Log user info and URL
  console.log('🔍 AppContainer Debug:', {
    userEmail: user.email,
    userName: user.name,
    isAdmin: user.is_admin,
    appId: app.id,
    iframeUrl,
  });

  return (
    <div className="ah-flex-col w-full h-screen">
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <button className="ah-btn-back" onClick={() => navigate('/lobby')}>
            ← Back
          </button>
          <div className="ah-flex-center gap-2">
            <span className="text-2xl">{app.icon}</span>
            <h2 className="ah-app-title">{app.name}</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {app.type === 'iframe' && iframeUrl ? (
          <iframe
            src={iframeUrl}
            title={app.name}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        ) : app.type === 'internal' ? (
          <div className="ah-flex-col-center-justify min-h-screen ah-container">
            <div className="text-6xl">{app.icon}</div>
            <h3 className="mt-4">{app.name}</h3>
            <p className="ah-meta">{app.description}</p>
            <p className="ah-meta">Internal app - handled by shell routing</p>
          </div>
        ) : (
          <div className="ah-flex-col-center-justify min-h-screen ah-container">
            <div className="text-6xl">{app.icon}</div>
            <h3 className="mt-4">{app.name}</h3>
            <p className="ah-meta">{app.description}</p>
            <p className="ah-meta">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppContainer;
