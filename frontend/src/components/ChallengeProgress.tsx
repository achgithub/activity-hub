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
          {isReady ? '✓ Ready' : '⏳ Waiting'}
        </div>
      </div>

      <div className="ah-flex-center justify-between mb-3 text-sm">
        <span className="ah-label">Players Accepted:</span>
        <span className="font-medium">
          {acceptedCount} / {minRequired}
        </span>
        <span className="ah-meta text-xs">
          ({totalInvited} invited)
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {challenge.playerIds?.map(playerId => {
          const hasAccepted = challenge.accepted?.includes(playerId);
          const isInitiator = playerId === challenge.initiatorId;

          return (
            <div key={playerId} className="ah-flex-center gap-2 py-1">
              <span className={hasAccepted ? 'text-green-600 text-lg' : 'text-stone-400 text-lg'}>
                {hasAccepted ? '✓' : '○'}
              </span>
              <span className="text-sm flex-1">
                {getUserName(playerId)}
              </span>
              {isInitiator && <span className="ah-meta text-xs">(host)</span>}
            </div>
          );
        })}
      </div>

      {isReady && (
        <div className="ah-banner--success text-center text-sm">
          Game will start automatically...
        </div>
      )}
    </div>
  );
};

export default ChallengeProgress;
