import React from 'react';

export interface GameCardProps {
  /** Game content */
  children: React.ReactNode;
  /** Maximum width (default: '600px') */
  maxWidth?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Standard game content card
 * Centers game content in a white card with consistent styling
 */
export function GameCard({ children, maxWidth = '600px', className }: GameCardProps) {
  return (
    <div className="ah-container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div
        className={`ah-card ${className || ''}`}
        style={{ maxWidth, margin: '0 auto', textAlign: 'center' }}
      >
        {children}
      </div>
    </div>
  );
}
