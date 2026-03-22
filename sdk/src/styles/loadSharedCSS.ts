/**
 * Auto-loads Activity Hub shared CSS
 * Called automatically when SDK is imported
 */
export function loadActivityHubCSS(): void {
  // Check if already loaded
  if (document.getElementById('ah-shared-css')) {
    return;
  }

  // Create and inject stylesheet link
  const link = document.createElement('link');
  link.id = 'ah-shared-css';
  link.rel = 'stylesheet';
  link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
  document.head.appendChild(link);
}

// Auto-load on module import
if (typeof document !== 'undefined') {
  loadActivityHubCSS();
}
