-- Migration 005: Cleanup Legacy Roles Column
-- Description: Clear the deprecated 'roles' TEXT array column in users table
-- Date: 2026-03-24
-- Related to: Roles system audit and standardization
--
-- Background:
-- The system has migrated from storing roles in users.roles (TEXT array)
-- to the normalized user_roles table. This migration clears the legacy column
-- to prevent confusion about source of truth.
--
-- The roles column will be retained for backward compatibility but kept empty.
-- Future migrations may drop this column entirely once all references are removed.

-- Clear legacy roles column for all users
UPDATE users
SET roles = '{}'
WHERE roles IS NOT NULL AND roles != '{}';

-- Add a comment to the column documenting its deprecated status
COMMENT ON COLUMN users.roles IS
  'DEPRECATED: Legacy role storage. Use user_roles table instead. This column is kept empty for backward compatibility.';

-- Verify the migration
DO $$
DECLARE
  users_with_roles INT;
BEGIN
  SELECT COUNT(*) INTO users_with_roles
  FROM users
  WHERE roles IS NOT NULL AND array_length(roles, 1) > 0;

  IF users_with_roles > 0 THEN
    RAISE EXCEPTION 'Migration failed: % users still have legacy roles', users_with_roles;
  ELSE
    RAISE NOTICE 'Migration successful: All legacy roles cleared from users table';
  END IF;
END $$;
