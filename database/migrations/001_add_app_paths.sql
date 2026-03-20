-- Add binary_path and static_path to applications table
-- Allows apps to be registered with explicit path locations
-- Enables apps in separate repositories to be launched via their own paths

ALTER TABLE applications
ADD COLUMN binary_path VARCHAR(500),      -- Path to app binary relative to activity hub root
ADD COLUMN static_path VARCHAR(500);      -- Path to static files relative to activity hub root

-- Create index on app IDs for faster lookups when launching
CREATE INDEX idx_applications_id ON applications(id);
