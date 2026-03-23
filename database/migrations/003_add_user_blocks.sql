-- Migration 003: Add user blocking functionality
-- This allows users to block other users from seeing them online or sending challenges

CREATE TABLE IF NOT EXISTS user_blocks (
    id BIGSERIAL PRIMARY KEY,
    blocker_email VARCHAR(255) NOT NULL,  -- User who is blocking
    blocked_email VARCHAR(255) NOT NULL,  -- User who is blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure user can't block same person twice
    UNIQUE(blocker_email, blocked_email),

    -- Prevent self-blocking
    CHECK (blocker_email != blocked_email)
);

-- Index for fast lookups when checking if user A blocks user B
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_email);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_email);

-- Composite index for bidirectional blocking checks
CREATE INDEX idx_user_blocks_both ON user_blocks(blocker_email, blocked_email);

-- Function to check if user A blocks user B OR user B blocks user A (bidirectional)
CREATE OR REPLACE FUNCTION are_users_blocked(email_a VARCHAR, email_b VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks
        WHERE (blocker_email = email_a AND blocked_email = email_b)
           OR (blocker_email = email_b AND blocked_email = email_a)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_blocks IS 'Tracks which users have blocked each other';
COMMENT ON FUNCTION are_users_blocked IS 'Returns true if either user has blocked the other';
