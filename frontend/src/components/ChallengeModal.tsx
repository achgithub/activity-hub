import React, { useState, useEffect } from 'react';
import { GameConfig, GameOption, ChallengeOptions, AppDefinition } from '../types';

interface ChallengeModalProps {
  targetUser: string;
  challengeableApps: AppDefinition[];
  onConfirm: (appId: string, options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string) => Promise<GameConfig | null>;
}

const ChallengeModal: React.FC<ChallengeModalProps> = ({
  targetUser,
  challengeableApps,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  // Step 1: Game selection, Step 2: Game options
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(
    challengeableApps.length === 1 ? challengeableApps[0] : null
  );
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Load game config when app is selected
  useEffect(() => {
    const loadConfig = async () => {
      if (selectedApp) {
        setLoading(true);
        const gameConfig = await fetchGameConfig(selectedApp.id);
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

    if (selectedApp) {
      loadConfig();
    }
  }, [selectedApp, fetchGameConfig]);

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
  };

  const renderOption = (option: GameOption) => {
    switch (option.type) {
      case 'select':
        return (
          <div key={option.id} className="ah-flex-col gap-1 mb-3">
            <label className="ah-label">{option.label}</label>
            <select
              className="ah-select"
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
          <div key={option.id} className="ah-flex-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={Boolean(options[option.id] ?? option.default)}
              onChange={(e) => handleOptionChange(option.id, e.target.checked)}
            />
            <label className="ah-label">{option.label}</label>
          </div>
        );

      case 'number':
        return (
          <div key={option.id} className="ah-flex-col gap-1 mb-3">
            <label className="ah-label">{option.label}</label>
            <input
              type="number"
              className="ah-input"
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

  // Go back to game selection
  const handleBack = () => {
    setSelectedApp(null);
    setConfig(null);
    setOptions({});
  };

  return (
    <div className="ah-modal-overlay" onClick={onCancel}>
      <div className="ah-modal" onClick={(e) => e.stopPropagation()}>
        {/* Game Selection Step */}
        {!selectedApp ? (
          <>
            <div className="ah-modal-header">
              <h2 className="ah-modal-title">🎮 Challenge {targetUser}</h2>
            </div>

            <div className="ah-modal-body">
              <p className="mb-4">Select a game:</p>
              <div className="ah-flex-col gap-2">
                {challengeableApps.map(app => (
                  <button
                    key={app.id}
                    className="ah-btn-outline w-full ah-flex-center gap-2 justify-start"
                    onClick={() => setSelectedApp(app)}
                  >
                    <span className="text-xl">{app.icon}</span>
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ah-modal-footer">
              <button className="ah-btn-danger" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Game Options Step */}
            <div className="ah-modal-header">
              <h2 className="ah-modal-title">{selectedApp.icon} Challenge to {selectedApp.name}</h2>
            </div>

            <div className="ah-modal-body">
              <p className="ah-meta">
                Challenging: <strong>{targetUser}</strong>
              </p>

              {loading ? (
                <div className="ah-flex-center justify-center py-4">
                  <div className="ah-spinner"></div>
                  <span className="ml-2 ah-meta">Loading options...</span>
                </div>
              ) : config?.gameOptions && config.gameOptions.length > 0 ? (
                <div className="mt-4">
                  <h3 className="ah-section-title">Game Settings</h3>
                  {config.gameOptions.map(renderOption)}
                </div>
              ) : (
                <p className="ah-meta">No additional options for this game.</p>
              )}
            </div>

            <div className="ah-modal-footer">
              {challengeableApps.length > 1 && (
                <button className="ah-btn-outline" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="ah-btn-danger" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="ah-btn-primary"
                onClick={() => onConfirm(selectedApp.id, options)}
                disabled={loading}
              >
                Send Challenge
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChallengeModal;
