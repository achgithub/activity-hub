import React, { useState, useEffect } from 'react';
import { GameConfig, GameOption, ChallengeOptions, AppDefinition } from '@activity-hub/core';

interface User {
  email: string;
  displayName: string;
  status: string;
}

interface MultiPlayerChallengeModalProps {
  currentUser: User;
  onlineUsers: User[];
  multiPlayerApps: AppDefinition[]; // Apps with minPlayers > 2 or maxPlayers > 2
  onConfirm: (appId: string, playerIds: string[], options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const MultiPlayerChallengeModal: React.FC<MultiPlayerChallengeModalProps> = ({
  currentUser,
  onlineUsers,
  multiPlayerApps,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  // Step 1: Game selection, Step 2: Player selection, Step 3: Game options
  const [step, setStep] = useState<'game' | 'players' | 'options'>('game');
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(
    multiPlayerApps.length === 1 ? multiPlayerApps[0] : null
  );
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([currentUser.email]);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Auto-advance to player selection if only one game
  useEffect(() => {
    if (multiPlayerApps.length === 1 && step === 'game') {
      setStep('players');
    }
  }, [multiPlayerApps.length, step]);

  // Load game config when moving to options step
  useEffect(() => {
    const loadConfig = async () => {
      if (selectedApp?.backendPort && step === 'options') {
        setLoading(true);
        const gameConfig = await fetchGameConfig(selectedApp.id, selectedApp.backendPort);
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
      }
    };

    loadConfig();
  }, [step, selectedApp, fetchGameConfig]);

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
  };

  const togglePlayer = (email: string) => {
    if (email === currentUser.email) return; // Can't deselect self

    setSelectedPlayers(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const isValidPlayerCount = () => {
    if (!selectedApp) return false;
    const count = selectedPlayers.length;
    return count >= (selectedApp.minPlayers || 2) && count <= (selectedApp.maxPlayers || 10);
  };

  const renderOption = (option: GameOption) => {
    switch (option.type) {
      case 'select':
        return (
          <div key={option.id} className="challenge-option">
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
          <div key={option.id} className="challenge-option checkbox">
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
          <div key={option.id} className="challenge-option">
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

  const handleBack = () => {
    if (step === 'options') {
      setStep('players');
      setConfig(null);
      setOptions({});
    } else if (step === 'players' && multiPlayerApps.length > 1) {
      setStep('game');
      setSelectedPlayers([currentUser.email]);
    }
  };

  const handleNext = () => {
    if (step === 'game' && selectedApp) {
      setStep('players');
    } else if (step === 'players' && isValidPlayerCount()) {
      setStep('options');
    }
  };

  return (
    <div className="ah-modal-overlay" onClick={onCancel}>
      <div className="ah-modal ah-modal--large" onClick={(e) => e.stopPropagation()}>
        {/* Step 1: Game Selection */}
        {step === 'game' && (
          <>
            <div className="ah-modal-header ah-flex ah-flex-center gap-3">
              <span className="text-2xl">🎮</span>
              <h2>Multi-Player Challenge</h2>
            </div>

            <div className="ah-modal-body">
              <p className="mb-4 font-semibold">Select a game:</p>
              <div className="ah-grid-auto">
                {multiPlayerApps.map(app => (
                  <button
                    key={app.id}
                    className="ah-card hover:shadow-lg transition-shadow text-left"
                    onClick={() => {
                      setSelectedApp(app);
                      handleNext();
                    }}
                  >
                    <div className="text-3xl mb-3">{app.icon}</div>
                    <h3 className="font-semibold mb-1">{app.name}</h3>
                    <p className="text-sm text-gray-600">
                      {app.minPlayers}-{app.maxPlayers} players
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="ah-modal-footer">
              <button className="ah-btn-outline ml-auto" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Step 2: Player Selection */}
        {step === 'players' && selectedApp && (
          <>
            <div className="ah-modal-header ah-flex ah-flex-center gap-3">
              <span className="text-2xl">{selectedApp.icon}</span>
              <h2>{selectedApp.name}</h2>
            </div>

            <div className="ah-modal-body">
              <p className="mb-4 font-semibold">
                Select players ({selectedApp.minPlayers}-{selectedApp.maxPlayers} total):
              </p>

              <div className="ah-list mb-4">
                {/* Show current user first (always selected) */}
                <div className="ah-list-item bg-blue-50">
                  <label className="ah-flex ah-flex-center gap-3">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="cursor-not-allowed"
                    />
                    <span className="font-medium">
                      {currentUser.displayName} <em className="text-gray-500">(you)</em>
                    </span>
                  </label>
                </div>

                {/* Other online users */}
                {onlineUsers
                  .filter(u => u.email !== currentUser.email)
                  .map(user => (
                    <div
                      key={user.email}
                      className={`ah-list-item cursor-pointer ${selectedPlayers.includes(user.email) ? 'bg-blue-50' : ''}`}
                      onClick={() => togglePlayer(user.email)}
                    >
                      <label className="ah-flex ah-flex-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.includes(user.email)}
                          onChange={() => togglePlayer(user.email)}
                        />
                        <span className="font-medium">{user.displayName}</span>
                      </label>
                    </div>
                  ))}
              </div>

              <div className={`text-sm ${!isValidPlayerCount() ? 'text-red-600' : 'text-gray-600'}`}>
                Selected: {selectedPlayers.length} / {selectedApp.maxPlayers || 10}
                {!isValidPlayerCount() && (
                  <span>
                    {selectedPlayers.length < (selectedApp.minPlayers || 2)
                      ? ` (need ${(selectedApp.minPlayers || 2) - selectedPlayers.length} more)`
                      : ' (too many players)'}
                  </span>
                )}
              </div>
            </div>

            <div className="ah-modal-footer ah-flex gap-2 justify-between">
              {multiPlayerApps.length > 1 && (
                <button className="ah-btn-back" onClick={handleBack}>
                  Back
                </button>
              )}
              <div className="ah-flex gap-2">
                <button className="ah-btn-outline" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  className="ah-btn-primary"
                  onClick={handleNext}
                  disabled={!isValidPlayerCount()}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Game Options */}
        {step === 'options' && selectedApp && (
          <>
            <div className="ah-modal-header ah-flex ah-flex-center gap-3">
              <span className="text-2xl">{selectedApp.icon}</span>
              <h2>Challenge to {selectedApp.name}</h2>
            </div>

            <div className="ah-modal-body">
              <div className="mb-6">
                <strong className="block mb-2">Players ({selectedPlayers.length}):</strong>
                <ul className="space-y-1">
                  {selectedPlayers.map(email => {
                    const user = [currentUser, ...onlineUsers].find(u => u.email === email);
                    return (
                      <li key={email} className="text-gray-700">
                        {user?.displayName || email}
                        {email === currentUser.email && ' <em className="text-gray-500">(you)</em>'}
                      </li>
                    );
                  })}
                </ul>
              </div>

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
              <button className="ah-btn-back" onClick={handleBack}>
                Back
              </button>
              <div className="ah-flex gap-2">
                <button className="ah-btn-outline" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  className="ah-btn-primary"
                  onClick={() => onConfirm(selectedApp.id, selectedPlayers, options)}
                  disabled={loading}
                >
                  Send Challenge
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MultiPlayerChallengeModal;
