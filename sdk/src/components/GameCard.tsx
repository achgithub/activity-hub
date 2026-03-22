import React from 'react';

export interface GameCardProps {
  /** Game content */
  children: React.ReactNode;
  /** Card size variant (default: 'medium') */
  size?: 'narrow' | 'medium' | 'wide';
  /** Additional CSS class names */
  className?: string;
}

/**
 * Standard game content card
 * Centers game content in a white card with consistent styling
 */
export function GameCard({ children, size = 'medium', className }: GameCardProps) {
  const sizeClass = size ? `ah-card--${size}` : '';

  return (
    <div className="ah-container ah-py-4">
      <div className={`ah-card ${sizeClass} ah-mx-auto ah-text-center ${className || ''}`}>
        {children}
      </div>
    </div>
  );
}
