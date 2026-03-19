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
    name VARCHAR(255),                     -- NULL until email is verified
    code_hash VARCHAR(255),                -- Bcrypt hash of password (NULL until verified)
    is_admin BOOLEAN DEFAULT FALSE,        -- Legacy admin flag (deprecated, use roles)
    roles TEXT[] DEFAULT '{}',             -- Array of role strings: 'super_user', 'setup_admin', etc.
    email_verified BOOLEAN DEFAULT FALSE,  -- User has verified their email address
    verified_at TIMESTAMP,                 -- When email was verified
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(email_verified);
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
-- TABLE 3: EMAIL_VERIFICATIONS
-- ============================================================================
-- Email verification tokens for sign-up and email changes
-- User receives email with verification link containing token
-- Token is single-use and expires after 24 hours
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,    -- Random token sent in email
    email VARCHAR(255) NOT NULL,           -- Email to be verified
    purpose VARCHAR(50) NOT NULL,          -- 'signup' or 'email_change'
    expires_at TIMESTAMP NOT NULL,         -- Token expires (24 hours)
    used_at TIMESTAMP,                     -- When token was used (NULL if unused)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verify_token ON email_verifications(token);
CREATE INDEX idx_email_verify_email ON email_verifications(email);
CREATE INDEX idx_email_verify_expires ON email_verifications(expires_at);

-- ============================================================================
-- TABLE 4: PASSWORD_RESETS
-- ============================================================================
-- Password reset tokens for forgotten passwords
-- User receives email with reset link containing token
-- Token is single-use and expires after 1 hour
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,    -- Random token sent in email
    email VARCHAR(255) NOT NULL,           -- Email requesting reset (FK to users)
    expires_at TIMESTAMP NOT NULL,         -- Token expires (1 hour)
    used_at TIMESTAMP,                     -- When token was used (NULL if unused)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_token ON password_resets(token);
CREATE INDEX idx_password_reset_email ON password_resets(email);
CREATE INDEX idx_password_reset_expires ON password_resets(expires_at);

-- ============================================================================
-- TABLE 4.5: USER_APP_PREFERENCES
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
-- TABLE 8: AH_GROUPS
-- ============================================================================
-- Activity Hub groups - collections that grant sets of permissions
-- Groups follow convention: ah_g_* (ah_g_super, ah_g_admin, ah_g_user_admin, etc.)
CREATE TABLE IF NOT EXISTS ah_groups (
    id VARCHAR(255) PRIMARY KEY,           -- 'ah_g_super', 'ah_g_admin', etc.
    name VARCHAR(255) NOT NULL,            -- Display name
    description TEXT,                      -- What this group grants
    is_system BOOLEAN DEFAULT FALSE,       -- System group (can't be deleted)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ah_groups_system ON ah_groups(is_system);

-- ============================================================================
-- TABLE 9: AH_ROLES
-- ============================================================================
-- Activity Hub roles - granular permissions for the platform
-- Roles follow convention: ah_r_* (ah_r_app_register, ah_r_app_control, etc.)
CREATE TABLE IF NOT EXISTS ah_roles (
    id VARCHAR(255) PRIMARY KEY,           -- 'ah_r_app_register', etc.
    name VARCHAR(255) NOT NULL,            -- Display name
    description TEXT,                      -- What this role allows
    is_system BOOLEAN DEFAULT FALSE,       -- System role (can't be deleted)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ah_roles_system ON ah_roles(is_system);

-- ============================================================================
-- TABLE 10: AH_GROUP_ROLES
-- ============================================================================
-- Mapping of groups to roles - groups grant multiple roles
-- Example: ah_g_admin group grants ah_r_app_register, ah_r_app_control roles
CREATE TABLE IF NOT EXISTS ah_group_roles (
    group_id VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (group_id, role_id),
    FOREIGN KEY (group_id) REFERENCES ah_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ah_roles(id) ON DELETE CASCADE
);

CREATE INDEX idx_ah_group_roles_group ON ah_group_roles(group_id);
CREATE INDEX idx_ah_group_roles_role ON ah_group_roles(role_id);

-- ============================================================================
-- TABLE 11: USER_ROLES
-- ============================================================================
-- User role assignments - who has what roles/groups
-- Roles can be:
--   - Activity Hub roles: 'ah_r_app_register', 'ah_r_app_control', etc.
--   - Activity Hub groups: 'ah_g_admin', 'ah_g_super', etc.
--   - App-specific roles: 'chess:admin', 'racing:player', 'leaderboard:guest', etc.
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,        -- Can be ah_r_*, ah_g_*, or app:role
    assigned_by VARCHAR(255),              -- Admin email who assigned this
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,                            -- Optional notes about assignment
    UNIQUE(user_email, role_id),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX idx_user_roles_email ON user_roles(user_email);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_assigned_at ON user_roles(assigned_at DESC);

-- ============================================================================
-- TABLE 12: APP_ROLES
-- ============================================================================
-- App-specific roles defined in app manifest
-- Auto-created when app is registered with manifest
-- Example: chess:admin, chess:player, leaderboard:guest
CREATE TABLE IF NOT EXISTS app_roles (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,         -- 'chess', 'racing', 'leaderboard'
    role_id VARCHAR(255) NOT NULL,        -- 'chess:admin', 'chess:player'
    label VARCHAR(255),                   -- Display name: 'Tournament Admin'
    description TEXT,                     -- 'Manage tournaments, ban players'
    is_default BOOLEAN DEFAULT FALSE,     -- Assigned to all users by default
    is_restricted BOOLEAN DEFAULT FALSE,  -- Can't be self-assigned
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, role_id),
    FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE INDEX idx_app_roles_app ON app_roles(app_id);
CREATE INDEX idx_app_roles_role ON app_roles(role_id);
CREATE INDEX idx_app_roles_default ON app_roles(app_id, is_default);

-- ============================================================================
-- TABLE 13: APP_MANIFESTS
-- ============================================================================
-- History of app manifest registrations
-- Tracks what roles each app version declared
CREATE TABLE IF NOT EXISTS app_manifests (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    manifest_json JSONB NOT NULL,         -- Full manifest including roles array
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registered_by VARCHAR(255),           -- Admin email
    is_current BOOLEAN DEFAULT TRUE,      -- Is this the active manifest?
    FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE INDEX idx_app_manifests_app ON app_manifests(app_id);
CREATE INDEX idx_app_manifests_current ON app_manifests(app_id, is_current);
CREATE INDEX idx_app_manifests_registered_at ON app_manifests(registered_at DESC);

-- ============================================================================
-- BOOTSTRAP DATA
-- ============================================================================
-- Initial user accounts and app definitions for fresh installation
--
-- Bootstrap admin user:
--   Email: admin@activity-hub.com
--   Password: 123456
--   Bcrypt hash: $2a$10$bz7aFH/Yx4h7zyKLa6.cXe4x/L1pFWrU9.rEqf6TK7j2bJ8w7dEyO
--   (Generate with: echo 123456 | htpasswd -nbBC 10 admin | cut -d: -f2)
--
-- New users register via self-registration flow:
--   1. POST /api/auth/register with email
--   2. Email verification link sent
--   3. User clicks link, sets password
--   4. Email verified, account active

-- Insert bootstrap admin user (verified, with password 123456)
INSERT INTO users (email, name, code_hash, is_admin, roles, email_verified, verified_at) VALUES
    ('admin@activity-hub.com', 'Admin', '$2a$10$bz7aFH/Yx4h7zyKLa6.cXe4x/L1pFWrU9.rEqf6TK7j2bJ8w7dEyO', TRUE, ARRAY['super_user', 'setup_admin'], TRUE, CURRENT_TIMESTAMP)
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

-- Insert Activity Hub groups
INSERT INTO ah_groups (id, name, description, is_system) VALUES
    ('ah_g_super', 'Super Admin', 'Full system access - everything', TRUE),
    ('ah_g_admin', 'App Admin', 'Register, edit, enable/disable apps', TRUE),
    ('ah_g_user_admin', 'User Admin', 'Manage users, assign roles', TRUE),
    ('ah_g_read', 'Read Only', 'View apps and settings, no modifications', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Insert Activity Hub roles
INSERT INTO ah_roles (id, name, description, is_system) VALUES
    ('ah_r_app_register', 'Register Apps', 'Can register new mini-apps', TRUE),
    ('ah_r_app_edit', 'Edit Apps', 'Can modify app metadata and settings', TRUE),
    ('ah_r_app_control', 'Control Apps', 'Can enable/disable apps for all users', TRUE),
    ('ah_r_user_manage', 'Manage Users', 'Can assign roles and groups to users', TRUE),
    ('ah_r_user_read', 'View Users', 'Can view user list and details', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Map groups to roles
INSERT INTO ah_group_roles (group_id, role_id) VALUES
    ('ah_g_super', 'ah_r_app_register'),
    ('ah_g_super', 'ah_r_app_edit'),
    ('ah_g_super', 'ah_r_app_control'),
    ('ah_g_super', 'ah_r_user_manage'),
    ('ah_g_super', 'ah_r_user_read'),
    ('ah_g_admin', 'ah_r_app_register'),
    ('ah_g_admin', 'ah_r_app_edit'),
    ('ah_g_admin', 'ah_r_app_control'),
    ('ah_g_user_admin', 'ah_r_user_manage'),
    ('ah_g_user_admin', 'ah_r_user_read'),
    ('ah_g_read', 'ah_r_user_read')
ON CONFLICT (group_id, role_id) DO NOTHING;

-- Assign bootstrap admin to super group
INSERT INTO user_roles (user_email, role_id, assigned_by, notes) VALUES
    ('admin@activity-hub.com', 'ah_g_super', 'system', 'Bootstrap super admin')
ON CONFLICT (user_email, role_id) DO NOTHING;

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
-- All 13 tables created with proper constraints, foreign keys, and indexes
-- Bootstrap admin user inserted with super admin group
-- Activity Hub groups and roles initialized
-- Helper functions for maintenance ready to use
--
-- Usage on Pi:
--   psql -d activity_hub < /path/to/init.sql
--
-- This creates:
-- - 13 tables (users, applications, user_app_preferences, challenges,
--   impersonation_sessions, email_verifications, password_resets,
--   app_lifecycle_events, awareness_events, ah_groups, ah_roles,
--   ah_group_roles, user_roles, app_roles, app_manifests)
-- - 30+ indexes for optimal query performance
-- - Foreign key constraints for referential integrity
-- - Bootstrap groups and roles for Activity Hub platform
-- - Helper functions for maintenance
-- - Bootstrap admin user (admin@activity-hub.com / 123456)
