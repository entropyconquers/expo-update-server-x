-- Migration: Create uploads table
-- This replaces the uploads array in db.json

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  project TEXT NOT NULL,
  version TEXT NOT NULL,
  release_channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'released', 'obsolete')),
  path TEXT NOT NULL, -- Will be R2 bucket path instead of local filesystem
  update_id TEXT NOT NULL,
  app_json TEXT NOT NULL, -- JSON string of the Expo app.json
  dependencies TEXT NOT NULL, -- JSON string of package.json dependencies
  git_branch TEXT,
  git_commit TEXT,
  original_filename TEXT NOT NULL,
  released_at DATETIME,
  
  -- Indexes for common queries
  UNIQUE(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_uploads_project_version_channel ON uploads(project, version, release_channel);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at);
CREATE INDEX idx_uploads_update_id ON uploads(update_id); 