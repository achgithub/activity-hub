-- App Launcher Lifecycle Event Tracking
-- Tracks all app launching, stopping, crashing, and health events for debugging and analytics

CREATE TABLE IF NOT EXISTS app_lifecycle_events (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- launched, stopped, crashed, health_check_failed
    pid INT,
    game_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_app_lifecycle_app ON app_lifecycle_events(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_lifecycle_event ON app_lifecycle_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_lifecycle_created ON app_lifecycle_events(created_at DESC);

-- Retention policy: Old events can be cleaned up after 30 days
-- See launcher_db.go CleanupOldAppEvents() for cleanup logic
