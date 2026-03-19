import React from 'react';
import { StatusLevels } from '../../types';
import PresenceBadge from './PresenceBadge';

interface StatusSelectorProps {
  currentStatus: string;
  onChange: (status: string) => void;
  disabled?: boolean;
}

const StatusSelector: React.FC<StatusSelectorProps> = ({ currentStatus, onChange, disabled = false }) => {
  const statuses = [
    { value: StatusLevels.ONLINE, label: 'Online', icon: '🟢' },
    { value: StatusLevels.AWAY, label: 'Away', icon: '🟡' },
    { value: StatusLevels.DO_NOT_DISTURB, label: 'Do Not Disturb', icon: '🔴' },
  ];

  return (
    <div className="ah-flex-col gap-2">
      <label className="text-sm font-semibold text-gray-700">Status</label>

      <div className="ah-flex-col gap-1">
        {statuses.map(status => (
          <button
            key={status.value}
            onClick={() => onChange(status.value)}
            disabled={disabled}
            className={`ah-card ah-flex-between py-2 px-3 text-left transition-all ${
              currentStatus === status.value
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="ah-flex-center gap-2">
              <span className="text-lg">{status.icon}</span>
              <span className="font-medium text-sm">{status.label}</span>
            </div>

            {currentStatus === status.value && (
              <span className="text-blue-600 font-bold">✓</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {currentStatus === StatusLevels.ONLINE && 'You are available for games and messages'}
        {currentStatus === StatusLevels.AWAY && 'You are away but can be contacted'}
        {currentStatus === StatusLevels.DO_NOT_DISTURB && 'You are unavailable for notifications'}
      </p>
    </div>
  );
};

export default StatusSelector;
