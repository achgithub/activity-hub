import React from 'react';
import { Challenge } from '@activity-hub/core';

interface User {
  email: string;
  displayName: string;
}

interface ChallengeProgressProps {
  challenge: Challenge;
  users: User[];
  appName: string;
}

const ChallengeProgress: React.FC<ChallengeProgressProps> = ({
  challenge,
  users,
  appName,
}) => {
  const getUserName = (email: string) => {
    const user = users.find(u => u.email === email);
    return user?.displayName || email;
  };

  const acceptedCount = challenge.accepted?.length || 0;
  const totalInvited = challenge.playerIds?.length || 0;
  const minRequired = challenge.minPlayers || 2;
  const progressPercent = Math.min((acceptedCount / minRequired) * 100, 100);
  const isReady = acceptedCount >= minRequired;

  return (
    <div className="ah-card">
      <div className="ah-flex-between mb-3">
        <h4 className="text-sm font-semibold">{appName} Challenge</h4>
        <div className={isReady ? 'ah-status--complete' : 'ah-status--waiting'}>
          {isReady ? '✓ Ready to Start' : '⏳ Waiting'}
        </div>
      </div>

      <style>{`
        .challenge-progress-bar-${challenge.id} { width: ${progressPercent}%; }
      `}</style>

      <div className="bg-stone-200 rounded h-2 mb-3 overflow-hidden">
        <div
          className={`challenge-progress-bar-${challenge.id} h-full ${isReady ? 'bg-green-600' : 'bg-blue-500'} transition-all duration-300`}
        />
      </div>

      <div className="ah-flex-between mb-3 text-sm">
        <span className="ah-label">Accepted:</span>
        <span className="font-medium">
          {acceptedCount} / {minRequired}
        </span>
        <span className="ah-meta">
          ({totalInvited} invited)
        </span>
      </div>

      <div className="space-y-2">
        {challenge.playerIds?.map(playerId => {
          const hasAccepted = challenge.accepted?.includes(playerId);
          const isInitiator = playerId === challenge.initiatorId;

          return (
            <div key={playerId} className="ah-flex-center gap-2 py-1">
              <span className={hasAccepted ? 'text-green-600' : 'text-stone-400'}>
                {hasAccepted ? '✓' : '○'}
              </span>
              <span className="text-sm">
                {getUserName(playerId)}
                {isInitiator && <em className="text-stone-500"> (host)</em>}
              </span>
            </div>
          );
        })}
      </div>

      {isReady && (
        <div className="ah-banner--success mt-4 text-center">
          Game will start automatically...
        </div>
      )}
    </div>
  );
};

export default ChallengeProgress;
