import React, { useState, useEffect } from 'react';
import { Challenge, AppDefinition, UserPresence } from '../types';
import ChallengeProgress from './ChallengeProgress';

interface ChallengesOverlayProps {
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  apps: AppDefinition[];
  userEmail: string;
  userName: string;
  onlineUsers: UserPresence[];
  onAccept: (challengeId: string, userId?: string) => Promise<boolean>;
  onReject: (challengeId: string) => Promise<boolean>;
  onClose: () => void;
}

const ChallengesOverlay: React.FC<ChallengesOverlayProps> = ({
  receivedChallenges,
  sentChallenges,
  apps,
  userEmail,
  userName,
  onlineUsers,
  onAccept,
  onReject,
  onClose,
}) => {
  // Force re-render every second to update timers
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(tick => tick + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Filter out expired challenges
  const now = Date.now();
  const activeReceivedChallenges = receivedChallenges.filter(
    challenge => challenge.expiresAt * 1000 > now
  );
  const activeSentChallenges = sentChallenges.filter(
    challenge => challenge.expiresAt * 1000 > now
  );

  const handleAcceptChallenge = async (challengeId: string) => {
    const challenge = receivedChallenges.find(c => c.id === challengeId);
    const isMultiPlayer = challenge?.playerIds && challenge.playerIds.length > 0;

    if (isMultiPlayer) {
      await onAccept(challengeId, userEmail);
    } else {
      await onAccept(challengeId);
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    await onReject(challengeId);
  };

  return (
    <div className="ah-modal-overlay" onClick={onClose}>
      <div className="ah-modal ah-modal--large" onClick={(e) => e.stopPropagation()}>
        <div className="ah-modal-header ah-flex ah-flex-between">
          <h3>Challenges</h3>
          <button className="ah-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ah-modal-body">
          {/* Received Challenges */}
          <div className="ah-mb-6">
            <h4 className="ah-section-title ah-mb-3">Received ({activeReceivedChallenges.length})</h4>
            {activeReceivedChallenges.length === 0 ? (
              <p className="ah-meta">No incoming challenges</p>
            ) : (
              <div className="ah-list">
                {activeReceivedChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

                  if (isMultiPlayer) {
                    const allUsers = [
                      { email: userEmail, displayName: userName, status: 'online' as const },
                      ...onlineUsers
                    ];

                    return (
                      <div key={challenge.id} className="ah-list-item">
                        <ChallengeProgress
                          challenge={challenge}
                          users={allUsers}
                          appName={appName}
                        />
                        {!challenge.accepted?.includes(userEmail) && (
                          <div className="ah-flex ah-gap-2">
                            <button
                              className="ah-btn-primary ah-btn-sm"
                              onClick={() => handleAcceptChallenge(challenge.id)}
                            >
                              Accept
                            </button>
                            <button
                              className="ah-btn-outline ah-btn-sm"
                              onClick={() => handleRejectChallenge(challenge.id)}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={challenge.id} className="ah-list-item ah-flex ah-flex-col ah-gap-2">
                      <div>
                        <strong>{challenge.fromUser}</strong> → <strong>{appName}</strong>
                      </div>
                      <div className="ah-flex ah-gap-2">
                        <button
                          className="ah-btn-primary ah-btn-sm"
                          onClick={() => handleAcceptChallenge(challenge.id)}
                        >
                          Accept
                        </button>
                        <button
                          className="ah-btn-outline ah-btn-sm"
                          onClick={() => handleRejectChallenge(challenge.id)}
                        >
                          Decline
                        </button>
                      </div>
                      <div className="ah-meta">
                        Expires in {Math.max(0, Math.floor((challenge.expiresAt * 1000 - Date.now()) / 1000))}s
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sent Challenges */}
          <div>
            <h4 className="ah-section-title ah-mb-3">Sent ({activeSentChallenges.length})</h4>
            {activeSentChallenges.length === 0 ? (
              <p className="ah-meta">No outgoing challenges</p>
            ) : (
              <div className="ah-list">
                {activeSentChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

                  if (isMultiPlayer) {
                    const allUsers = [
                      { email: userEmail, displayName: userName, status: 'online' as const },
                      ...onlineUsers
                    ];

                    return (
                      <div key={challenge.id} className="ah-list-item">
                        <ChallengeProgress
                          challenge={challenge}
                          users={allUsers}
                          appName={appName}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={challenge.id} className="ah-list-item ah-flex ah-flex-col ah-gap-2">
                      <div>
                        <strong>{challenge.toUser}</strong> → <strong>{appName}</strong>
                      </div>
                      <div className="ah-meta">
                        Waiting for response...
                      </div>
                      <div className="ah-meta">
                        Expires in {Math.max(0, Math.floor((challenge.expiresAt * 1000 - Date.now()) / 1000))}s
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengesOverlay;
