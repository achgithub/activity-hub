import React from 'react';
import { SessionParticipant } from '../../types';

interface SessionParticipantsProps {
  participants: SessionParticipant[];
  currentUserId: string;
  showGracePeriod?: boolean;
  maxDisplay?: number;
}

const SessionParticipants: React.FC<SessionParticipantsProps> = ({
  participants,
  currentUserId,
  showGracePeriod = true,
  maxDisplay = 10,
}) => {
  const activeParticipants = participants
    .filter(p => p.status === 'active')
    .slice(0, maxDisplay);
  const graceParticipants = participants.filter(p => p.status === 'grace_period');
  const leftParticipants = participants.filter(p => p.status === 'left');

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return '✅ In Game';
      case 'grace_period':
        return '⏳ Reconnecting...';
      case 'left':
        return '❌ Left';
      default:
        return status;
    }
  };

  return (
    <div className="ah-flex-col gap-4">
      {/* Active Participants */}
      <div className="ah-flex-col gap-2">
        <h3 className="font-semibold text-sm text-gray-700">In Game ({activeParticipants.length})</h3>
        {activeParticipants.length === 0 ? (
          <p className="ah-meta text-xs">No active participants</p>
        ) : (
          <div className="ah-flex-col gap-2">
            {activeParticipants.map(participant => (
              <div key={participant.userId} className="ah-card ah-flex-between py-2">
                <div className="ah-flex-center gap-2">
                  <div className="w-8 h-8 ah-flex-center-justify bg-blue-400 rounded-full text-white text-xs font-bold">
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">
                    {participant.displayName}
                    {participant.userId === currentUserId && <span className="text-xs text-blue-600 ml-2">(You)</span>}
                  </span>
                </div>
                <span className="text-xs text-green-600">🟢 Active</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grace Period Participants */}
      {showGracePeriod && graceParticipants.length > 0 && (
        <div className="ah-flex-col gap-2">
          <h3 className="font-semibold text-sm text-gray-700">Reconnecting ({graceParticipants.length})</h3>
          <p className="ah-meta text-xs">Will rejoin if they reconnect within 30 seconds</p>
          <div className="ah-flex-col gap-2">
            {graceParticipants.map(participant => (
              <div key={participant.userId} className="ah-card ah-flex-between py-2 opacity-75">
                <div className="ah-flex-center gap-2">
                  <div className="w-8 h-8 ah-flex-center-justify bg-yellow-400 rounded-full text-white text-xs font-bold">
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">{participant.displayName}</span>
                </div>
                <span className="text-xs text-yellow-600">🟡 Away</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left Participants */}
      {leftParticipants.length > 0 && (
        <div className="ah-flex-col gap-2">
          <h3 className="font-semibold text-sm text-gray-700">Left ({leftParticipants.length})</h3>
          <div className="ah-flex-col gap-2">
            {leftParticipants.slice(0, 3).map(participant => (
              <div key={participant.userId} className="ah-card ah-flex-between py-2 opacity-50">
                <div className="ah-flex-center gap-2">
                  <div className="w-8 h-8 ah-flex-center-justify bg-gray-400 rounded-full text-white text-xs font-bold">
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">{participant.displayName}</span>
                </div>
                <span className="text-xs text-gray-600">⚪ Left</span>
              </div>
            ))}
            {leftParticipants.length > 3 && (
              <p className="ah-meta text-xs">+{leftParticipants.length - 3} more left</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionParticipants;
