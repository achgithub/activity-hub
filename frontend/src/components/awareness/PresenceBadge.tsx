import React from 'react';

interface PresenceBadgeProps {
  status: 'online' | 'in_game' | 'away' | 'offline' | 'do_not_disturb';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const PresenceBadge: React.FC<PresenceBadgeProps> = ({ status, size = 'medium', showLabel = false }) => {
  const statusConfig = {
    online: { icon: '🟢', label: 'Online', className: 'ah-status-dot--online' },
    in_game: { icon: '🎮', label: 'In Game', className: 'ah-status--active' },
    away: { icon: '🟡', label: 'Away', className: 'ah-status-dot--away' },
    offline: { icon: '⚪', label: 'Offline', className: 'ah-status-dot--offline' },
    do_not_disturb: { icon: '🔴', label: 'Do Not Disturb', className: 'ah-status--away' },
  };

  const config = statusConfig[status] || statusConfig.offline;
  const sizeClass = size === 'small' ? 'text-xs' : size === 'large' ? 'text-xl' : 'text-sm';

  return (
    <div className="ah-flex-center gap-2">
      <span className={`${sizeClass} leading-none`}>{config.icon}</span>
      {showLabel && <span className="text-sm text-gray-600">{config.label}</span>}
    </div>
  );
};

export default PresenceBadge;
