-- Awareness Service Event Tracking
-- Tracks user presence, status changes, and multiplayer session events

CREATE TABLE IF NOT EXISTS awareness_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- heartbeat, status_change, session_join, session_leave, reconnect, timeout
    app_id VARCHAR(100),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_awareness_user_time ON awareness_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_awareness_event_time ON awareness_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_awareness_session_time ON awareness_events(app_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_awareness_created ON awareness_events(created_at DESC);

-- Retention policy: Old events can be cleaned up after 30 days
-- See awareness_db.go CleanupOldAwarenessEvents() for cleanup logic

-- Redis keys (NOT in database, but documented for reference):
-- awareness:user:{userId} - User presence hash (45s TTL)
-- awareness:session:{appId}:{sessionId} - Session participants hash (1hr TTL)
-- awareness:grace:{appId}:{sessionId}:{userId} - Grace period flag (30s TTL)
