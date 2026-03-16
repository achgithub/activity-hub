import React from 'react';
import { UserAwareness } from '@activity-hub/core';
import PresenceBadge from './PresenceBadge';

interface OnlineUsersListProps {
  users: UserAwareness[];
  onUserClick?: (user: UserAwareness) => void;
  showStatus?: boolean;
  showCurrentApp?: boolean;
  emptyMessage?: string;
}

const OnlineUsersList: React.FC<OnlineUsersListProps> = ({
  users,
  onUserClick,
  showStatus = true,
  showCurrentApp = true,
  emptyMessage = 'No users online',
}) => {
  if (users.length === 0) {
    return (
      <div className="ah-flex-col-center-justify py-8 ah-container">
        <p className="ah-meta">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="ah-flex-col gap-2">
      {users.map(user => (
        <div
          key={user.userId}
          className="ah-card ah-flex-between hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onUserClick?.(user)}
        >
          <div className="ah-flex-center gap-3">
            <div className="w-10 h-10 ah-flex-center-justify bg-gradient-to-br from-blue-400 to-purple-500 rounded-full text-white font-bold">
              {user.displayName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <h4 className="font-semibold">{user.displayName}</h4>
              <p className="text-xs text-gray-500">{user.userId}</p>

              {showCurrentApp && user.currentApp && (
                <p className="text-xs text-blue-600 mt-1">In {user.currentApp}</p>
              )}
            </div>
          </div>

          {showStatus && <PresenceBadge status={user.status as any} />}
        </div>
      ))}
    </div>
  );
};

export default OnlineUsersList;
