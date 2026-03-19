import React, { useState, useEffect } from 'react';
import { AppDefinition, UserPresence, GameConfig, GameOption, ChallengeOptions } from '../types';

interface GameChallengeModalProps {
  app: AppDefinition;
  currentUserEmail: string;
  onlineUsers: UserPresence[];
  favoriteUsers: Set<string>;
  onConfirm: (appId: string, playerIds: string[], options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string) => Promise<GameConfig | null>;
}

const GameChallengeModal: React.FC<GameChallengeModalProps> = ({
  app,
  currentUserEmail,
  onlineUsers,
  favoriteUsers,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  const [step, setStep] = useState<'select-players' | 'game-options'>('select-players');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Determine if this is a 1v1 or group game
  const isGroupGame = (app.minPlayers ?? 0) > 2;
  const minPlayers = app.minPlayers ?? 1; // Use ?? to properly handle 0
  const maxPlayers = app.maxPlayers ?? (isGroupGame ? 6 : 1);
  const supportsSoloPlay = app.minPlayers === 0;

  // Filter and sort online users (favorites first)
  const filteredUsers = onlineUsers
    .filter(user =>
      user.email !== currentUserEmail &&
      (filterText === '' ||
        user.displayName.toLowerCase().includes(filterText.toLowerCase()) ||
        user.email.toLowerCase().includes(filterText.toLowerCase()))
    )
    .sort((a, b) => {
      const aIsFavorite = favoriteUsers.has(a.email);
      const bIsFavorite = favoriteUsers.has(b.email);

      // Favorites first
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;

      // Then alphabetical by display name
      return a.displayName.localeCompare(b.displayName);
    });

  // Load game config when component mounts
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      const gameConfig = await fetchGameConfig(app.id);
      setConfig(gameConfig);

      // Initialize options with defaults
      if (gameConfig?.gameOptions) {
        const defaults: ChallengeOptions = {};
        gameConfig.gameOptions.forEach(opt => {
          defaults[opt.id] = opt.default;
        });
        setOptions(defaults);
      }
      setLoading(false);
    };

    loadConfig();
  }, [app, fetchGameConfig]);

  const togglePlayer = (email: string) => {
    if (isGroupGame) {
      // Multi-select for group games
      if (selectedPlayers.includes(email)) {
        setSelectedPlayers(selectedPlayers.filter(e => e !== email));
      } else if (selectedPlayers.length < maxPlayers) {
        setSelectedPlayers([...selectedPlayers, email]);
      }
    } else {
      // Single select for 1v1 games
      setSelectedPlayers([email]);
    }
  };

  const canProceed = selectedPlayers.length >= minPlayers && selectedPlayers.length <= maxPlayers;

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
  };

  const renderOption = (option: GameOption) => {
    switch (option.type) {
      case 'select':
        return (
          <div key={option.id} className="game-option">
            <label>{option.label}</label>
            <select
              value={String(options[option.id] ?? option.default)}
              onChange={(e) => {
                const val = option.options?.find(o => String(o.value) === e.target.value)?.value;
                handleOptionChange(option.id, val ?? e.target.value);
              }}
            >
              {option.options?.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={option.id} className="game-option checkbox">
            <label>
              <input
                type="checkbox"
                checked={Boolean(options[option.id] ?? option.default)}
                onChange={(e) => handleOptionChange(option.id, e.target.checked)}
              />
              {option.label}
            </label>
          </div>
        );

      case 'number':
        return (
          <div key={option.id} className="game-option">
            <label>{option.label}</label>
            <input
              type="number"
              value={Number(options[option.id] ?? option.default)}
              min={option.min}
              max={option.max}
              onChange={(e) => handleOptionChange(option.id, parseInt(e.target.value, 10))}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ah-modal-overlay" onClick={onCancel}>
      <div className="ah-modal ah-modal--large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ah-modal-header ah-flex ah-flex-center gap-3">
          <span className="text-3xl">{app.icon}</span>
          <h2>{app.name}</h2>
        </div>

        {/* Step 1: Select Players */}
        {step === 'select-players' && (
          <>
            <div className="ah-modal-body">
              <p className="mb-4 font-semibold">
                {isGroupGame
                  ? `Select ${minPlayers} to ${maxPlayers} players`
                  : supportsSoloPlay
                  ? 'Play solo or challenge another player'
                  : 'Who are you challenging?'}
              </p>

              {/* Solo play button */}
              {supportsSoloPlay && (
                <button
                  className="ah-btn-primary w-full mb-4"
                  onClick={() => {
                    if (config?.gameOptions && config.gameOptions.length > 0) {
                      // If there are game options, go to options step
                      setSelectedPlayers([]);
                      setStep('game-options');
                    } else {
                      // No options, launch immediately
                      onConfirm(app.id, [], {});
                    }
                  }}
                >
                  🎮 Play Solo
                </button>
              )}

              {/* Divider when solo play is available */}
              {supportsSoloPlay && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="text-gray-500 text-sm">or</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
              )}

              {/* Filter input */}
              <input
                type="text"
                className="ah-input w-full mb-4"
                placeholder="Search players..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                autoFocus={!supportsSoloPlay}
              />

              {/* Player selection */}
              <div className="ah-list">
                {filteredUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No players available</p>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user.email}
                      className={`ah-list-item cursor-pointer ${selectedPlayers.includes(user.email) ? 'bg-blue-50' : ''} ${favoriteUsers.has(user.email) ? 'border-l-4 border-yellow-400' : ''}`}
                      onClick={() => togglePlayer(user.email)}
                    >
                      <div className="ah-flex ah-flex-center gap-2 flex-1">
                        <span className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        <span className="font-medium">{user.displayName}</span>
                        {user.currentApp && (
                          <span className="text-sm text-gray-500">Playing {user.currentApp}</span>
                        )}
                      </div>
                      <div>
                        {selectedPlayers.includes(user.email) && '✓'}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Selected count for group games only (not solo-capable games) */}
              {isGroupGame && !supportsSoloPlay && (
                <p className="mt-4 text-sm text-gray-600">
                  Selected: {selectedPlayers.length} / {maxPlayers}
                  {selectedPlayers.length < minPlayers && ` (min ${minPlayers})`}
                </p>
              )}
            </div>

            <div className="ah-modal-footer ah-flex gap-2 justify-end">
              <button className="ah-btn-outline" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="ah-btn-primary"
                onClick={() => setStep('game-options')}
                disabled={!canProceed}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2: Game Options */}
        {step === 'game-options' && (
          <>
            <div className="ah-modal-body">
              {selectedPlayers.length === 0 ? (
                <p className="mb-4 font-semibold">
                  Playing <strong>Solo</strong>
                </p>
              ) : (
                <p className="mb-4 font-semibold">
                  Challenging: <strong>{selectedPlayers.map(email =>
                    onlineUsers.find(u => u.email === email)?.displayName || email
                  ).join(', ')}</strong>
                </p>
              )}

              {loading ? (
                <div className="text-center py-8">Loading game options...</div>
              ) : config?.gameOptions && config.gameOptions.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="ah-section-title">Game Settings</h3>
                  {config.gameOptions.map(renderOption)}
                </div>
              ) : (
                <p className="text-gray-500">No additional options for this game.</p>
              )}
            </div>

            <div className="ah-modal-footer ah-flex gap-2 justify-between">
              <button className="ah-btn-back" onClick={() => setStep('select-players')}>
                Back
              </button>
              <div className="ah-flex gap-2">
                <button className="ah-btn-outline" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  className="ah-btn-primary"
                  onClick={() => onConfirm(app.id, selectedPlayers, options)}
                  disabled={loading}
                >
                  {selectedPlayers.length === 0 ? 'Start Game' : 'Send Challenge'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GameChallengeModal;
