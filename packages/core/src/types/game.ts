/**
 * Game Configuration Types
 */

export interface GameOptionChoice {
  value: string | number;
  label: string;
}

export interface GameOption {
  id: string;
  type: 'select' | 'checkbox' | 'number';
  label: string;
  default: string | number | boolean;
  options?: GameOptionChoice[];
  min?: number;
  max?: number;
}

export interface GameConfig {
  appId: string;
  name: string;
  icon: string;
  description: string;
  gameOptions: GameOption[];
}

export interface ChallengeOptions {
  [key: string]: string | number | boolean;
}
