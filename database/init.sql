-- Activity Hub - Complete Database Initialization Schema
-- Fresh installation for Raspberry Pi deployment
-- Includes all tables, constraints, indexes, and bootstrap data

-- ============================================================================
-- TABLE 1: USERS
-- ============================================================================
-- Core authentication and user profiles
-- Stores user identity, authentication credentials, and roles
CREATE TABLE IF NOT EXISTS users (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255),                -- Bcrypt hash of password (can be NULL for demo tokens)
    is_admin BOOLEAN DEFAULT FALSE,        -- Legacy admin flag (deprecated, use roles)
    roles TEXT[] DEFAULT '{}',             -- Array of role strings: 'super_user', 'setup_admin', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_roles ON users USING GIN(roles);

-- ============================================================================
-- TABLE 2: APPLICATIONS
-- ============================================================================
-- App registry - defines all available mini-apps
-- Used by app launcher to manage app lifecycle
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(255) PRIMARY KEY,           -- App ID: tic-tac-toe, leaderboard, etc.
    name VARCHAR(255) NOT NULL,            -- Display name
    icon VARCHAR(255),                     -- Icon URL or CSS class
    type VARCHAR(50) NOT NULL,             -- Type: 'game' or 'utility'
    description TEXT,                      -- App description
    category VARCHAR(100),                 -- Category: 'game', 'utility', etc.
    url VARCHAR(255),                      -- Legacy TCP port URL (deprecated, kept for reference)
    backend_port INT,                      -- Legacy TCP port number (deprecated)
    realtime VARCHAR(50) DEFAULT 'none',   -- Real-time type: 'none', 'sse', 'websocket'
    min_players INT DEFAULT 1,             -- Minimum players (for multiplayer games)
    max_players INT,                       -- Maximum players (NULL = unlimited)
    required_roles TEXT[] DEFAULT '{}',    -- Array of required roles to access this app
    guest_accessible BOOLEAN DEFAULT TRUE, -- Can guests access this app?
    enabled BOOLEAN DEFAULT TRUE,          -- Is app available?
    display_order INT DEFAULT 999,         -- Sort order in UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apps_type ON applications(type);
CREATE INDEX idx_apps_category ON applications(category);
CREATE INDEX idx_apps_enabled ON applications(enabled);
CREATE INDEX idx_apps_display_order ON applications(display_order);

-- ============================================================================
-- TABLE 3: USER_APP_PREFERENCES
-- ============================================================================
-- User customization per app (visibility, favorites, custom ordering)
-- Allows users to hide apps, mark favorites, reorder
CREATE TABLE IF NOT EXISTS user_app_preferences (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    app_id VARCHAR(255) NOT NULL,
    is_hidden BOOLEAN DEFAULT FALSE,      -- User has hidden this app
    is_favorite BOOLEAN DEFAULT FALSE,    -- User marked as favorite
    custom_order INT,                     -- User's custom sort order (NULL = default)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
    CONSTRAINT fk_app_id FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE,
    CONSTRAINT uk_user_app UNIQUE(user_email, app_id)
);

CREATE INDEX idx_user_app_user ON user_app_preferences(user_email);
CREATE INDEX idx_user_app_hidden ON user_app_preferences(user_email, is_hidden);
CREATE INDEX idx_user_app_favorite ON user_app_preferences(user_email, is_favorite);

-- ============================================================================
-- TABLE 4: CHALLENGES
-- ============================================================================
-- Game challenges - both 2-player (legacy) and multi-player (new)
-- Supports:
--   - 2-player: from_user challenges to_user
--   - Multi-player: initiator_id challenges multiple player_ids
CREATE TABLE IF NOT EXISTS challenges (
    id VARCHAR(255) PRIMARY KEY,           -- Challenge ID (UUID format)
    from_user VARCHAR(255),                -- Legacy 2-player: who sent challenge
    to_user VARCHAR(255),                  -- Legacy 2-player: who received challenge
    initiator_id VARCHAR(255),             -- New multi-player: who initiated
    player_ids JSONB DEFAULT '[]'::JSONB, -- New multi-player: array of email addresses
    app_id VARCHAR(255) NOT NULL,          -- Which game this challenge is for
    status VARCHAR(50) DEFAULT 'pending',  -- Status: pending, active, completed, rejected, expired
    min_players INT,                       -- Minimum players for multi-player
    max_players INT,                       -- Maximum players for multi-player
    options JSONB,                         -- Flexible game-specific options (stakes, difficulty, etc.)
    expires_at TIMESTAMP,                  -- When challenge expires
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,                -- When challenge was accepted/rejected
    completed_at TIMESTAMP,                -- When game completed
    CONSTRAINT fk_from_user FOREIGN KEY (from_user) REFERENCES users(email) ON DELETE SET NULL,
    CONSTRAINT fk_to_user FOREIGN KEY (to_user) REFERENCES users(email) ON DELETE SET NULL,
    CONSTRAINT fk_initiator FOREIGN KEY (initiator_id) REFERENCES users(email) ON DELETE SET NULL,
    CONSTRAINT fk_challenge_app FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE INDEX idx_challenges_from_user ON challenges(from_user);
CREATE INDEX idx_challenges_to_user ON challenges(to_user);
CREATE INDEX idx_challenges_initiator ON challenges(initiator_id);
CREATE INDEX idx_challenges_app ON challenges(app_id);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_expires ON challenges(expires_at);
CREATE INDEX idx_challenges_player_ids ON challenges USING GIN(player_ids);

-- ============================================================================
-- TABLE 5: IMPERSONATION_SESSIONS
-- ============================================================================
-- Admin impersonation tracking
-- Allows super_user to impersonate other users for debugging
-- Maintains audit trail of impersonation
CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id SERIAL PRIMARY KEY,
    super_user_email VARCHAR(255) NOT NULL,
    impersonated_email VARCHAR(255) NOT NULL,
    original_token VARCHAR(500),           -- Super user's original token (JWT)
    impersonation_token VARCHAR(500),      -- Generated impersonation token
    is_active BOOLEAN DEFAULT TRUE,        -- Is this session still active?
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,                    -- When session was ended
    CONSTRAINT fk_super_user FOREIGN KEY (super_user_email) REFERENCES users(email) ON DELETE CASCADE,
    CONSTRAINT fk_impersonated_user FOREIGN KEY (impersonated_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX idx_impersonation_super_user ON impersonation_sessions(super_user_email);
CREATE INDEX idx_impersonation_impersonated ON impersonation_sessions(impersonated_email);
CREATE INDEX idx_impersonation_active ON impersonation_sessions(is_active);
CREATE INDEX idx_impersonation_created ON impersonation_sessions(created_at DESC);

-- ============================================================================
-- TABLE 6: APP_LIFECYCLE_EVENTS
-- ============================================================================
-- App launcher event logging
-- Tracks app launches, stops, crashes, health checks for debugging and analytics
-- Used by app launcher service to monitor mini-app lifecycle
CREATE TABLE IF NOT EXISTS app_lifecycle_events (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,      -- launched, stopped, crashed, health_check_failed, restarted
    pid INT,                               -- Process ID of the app instance
    game_id VARCHAR(255),                  -- Game ID if app was launched for specific game
    error_message TEXT,                    -- Error details if crash/failure
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_lifecycle_app ON app_lifecycle_events(app_id, created_at DESC);
CREATE INDEX idx_app_lifecycle_event_type ON app_lifecycle_events(event_type, created_at DESC);
CREATE INDEX idx_app_lifecycle_pid ON app_lifecycle_events(pid);

-- Cleanup old app events (30+ days) - optional, can be run as scheduled job
-- DELETE FROM app_lifecycle_events WHERE created_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- TABLE 7: AWARENESS_EVENTS
-- ============================================================================
-- User presence and session tracking
-- Logs heartbeats, status changes, session joins/leaves, grace period reconnections
-- Used by awareness service and analytics
CREATE TABLE IF NOT EXISTS awareness_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,      -- heartbeat, status_change, session_join, session_leave, reconnect, grace_period_expired
    status VARCHAR(50),                   -- For status_change events: online, in_game, away, offline, do_not_disturb
    app_id VARCHAR(100),                  -- For session events: app ID
    session_id VARCHAR(255),              -- For session events: session/game ID
    metadata JSONB,                       -- Flexible event metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_awareness_user_time ON awareness_events(user_id, created_at DESC);
CREATE INDEX idx_awareness_event_type ON awareness_events(event_type, created_at DESC);
CREATE INDEX idx_awareness_session ON awareness_events(app_id, session_id, created_at DESC);

-- Cleanup old awareness events (30+ days) - optional, can be run as scheduled job
-- DELETE FROM awareness_events WHERE created_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- BOOTSTRAP DATA
-- ============================================================================
-- Initial user accounts and app definitions for fresh installation

-- Insert demo users
INSERT INTO users (email, name, is_admin, roles) VALUES
    ('admin@test.com', 'Admin User', TRUE, ARRAY['super_user', 'setup_admin']),
    ('alice@test.com', 'Alice', FALSE, ARRAY[]::TEXT[]),
    ('bob@test.com', 'Bob', FALSE, ARRAY[]::TEXT[])
ON CONFLICT (email) DO NOTHING;

-- Insert app definitions
INSERT INTO applications (id, name, icon, type, description, category, realtime, min_players, max_players, enabled, display_order) VALUES
    ('tic-tac-toe', 'Tic-Tac-Toe', '🎮', 'game', 'Classic 2-player tic-tac-toe', 'game', 'sse', 2, 2, TRUE, 1),
    ('dots', 'Dots & Boxes', '📦', 'game', 'Strategy game for 2+ players', 'game', 'sse', 2, 4, TRUE, 2),
    ('last-man-standing', 'Last Man Standing', '🏆', 'game', 'Elimination game for 3-6 players', 'game', 'sse', 3, 6, TRUE, 3),
    ('sweepstakes', 'Sweepstakes', '🎨', 'game', 'Draw competitions', 'game', 'sse', 2, 8, TRUE, 4),
    ('quiz-player', 'Quiz Player', '❓', 'game', 'Quiz participant interface', 'game', 'sse', 1, 100, TRUE, 5),
    ('spoof', 'Spoof', '🪙', 'game', '3-6 player coin game', 'game', 'sse', 3, 6, TRUE, 6),
    ('rrroll-the-dice', 'Roll The Dice', '🎲', 'game', 'Dice rolling game', 'game', 'sse', 2, 6, TRUE, 7),
    ('sudoku', 'Sudoku', '🧩', 'game', 'Puzzle generator and solver', 'game', 'none', 1, 1, TRUE, 8),
    ('bulls-and-cows', 'Bulls and Cows', '🎯', 'game', '2-player code-breaking game', 'game', 'sse', 2, 2, TRUE, 9),
    ('leaderboard', 'Leaderboard', '📊', 'utility', 'Game statistics and rankings', 'utility', 'none', 1, NULL, TRUE, 101),
    ('game-admin', 'Game Admin', '⚙️', 'utility', 'Centralized game management', 'utility', 'none', 1, NULL, FALSE, 102),
    ('season-scheduler', 'Season Scheduler', '📅', 'utility', 'League scheduling and management', 'utility', 'none', 1, NULL, FALSE, 103),
    ('quiz-master', 'Quiz Master', '🎤', 'utility', 'Quiz host controls', 'utility', 'sse', 1, NULL, TRUE, 104),
    ('quiz-display', 'Quiz Display', '📺', 'utility', 'Quiz TV display system', 'utility', 'sse', 1, NULL, TRUE, 105)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS (Optional - for maintenance)
-- ============================================================================

-- Function to cleanup old events (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS TABLE(app_events_deleted INT, awareness_events_deleted INT) AS $$
DECLARE
    app_count INT;
    awareness_count INT;
BEGIN
    DELETE FROM app_lifecycle_events WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS app_count = ROW_COUNT;

    DELETE FROM awareness_events WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS awareness_count = ROW_COUNT;

    RETURN QUERY SELECT app_count, awareness_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user presence status (from awareness_events)
CREATE OR REPLACE FUNCTION get_user_status(p_user_id VARCHAR(255))
RETURNS TABLE(user_id VARCHAR(255), latest_status VARCHAR(50), last_seen TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (ae.user_id)
        ae.user_id,
        ae.status,
        ae.created_at
    FROM awareness_events ae
    WHERE ae.user_id = p_user_id
        AND ae.event_type = 'status_change'
    ORDER BY ae.user_id, ae.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- All 7 tables created with proper constraints, foreign keys, and indexes
-- Bootstrap data (3 users, 14 apps) inserted
-- Helper functions for maintenance ready to use
--
-- Usage on Pi:
--   psql -U activityhub -d activity_hub < /path/to/init.sql
--
-- This creates:
-- - 7 tables (users, applications, user_app_preferences, challenges,
--   impersonation_sessions, app_lifecycle_events, awareness_events)
-- - 20+ indexes for optimal query performance
-- - Foreign key constraints for referential integrity
-- - Helper functions for maintenance
-- - Bootstrap data for testing
