-- Migration: Add auto_cleanup_enabled column to apps table
-- Default to enabled (1) for all existing apps

ALTER TABLE apps ADD COLUMN auto_cleanup_enabled INTEGER DEFAULT 1;

-- Update any existing apps to have auto cleanup enabled by default
UPDATE apps SET auto_cleanup_enabled = 1 WHERE auto_cleanup_enabled IS NULL; 