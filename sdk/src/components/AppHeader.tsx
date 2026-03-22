import React from 'react';

export interface AppHeaderProps {
  /** App title to display */
  title: string;
  /** App icon emoji */
  icon?: string;
  /** Optional custom content for right side of header */
  rightContent?: React.ReactNode;
  /** Show back button (default: true) */
  showBackButton?: boolean;
  /** Custom back button click handler */
  onBackClick?: () => void;
}

/**
 * Standard Activity Hub app header
 * Enforces consistent design across all mini-apps
 */
export function AppHeader({
  title,
  icon,
  rightContent,
  showBackButton = true,
  onBackClick,
}: AppHeaderProps) {
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      window.location.href = '/lobby';
    }
  };

  return (
    <div className="ah-app-header">
      <div className="ah-app-header-left">
        {icon && <span className="ah-icon-md">{icon}</span>}
        <h1 className="ah-app-title">{title}</h1>
      </div>
      <div className="ah-app-header-right">
        {rightContent}
        {showBackButton && (
          <button className="ah-lobby-btn" onClick={handleBackClick}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
