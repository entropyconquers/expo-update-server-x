-- Migration: Create apps table  
-- This replaces the apps array in db.json

CREATE TABLE apps (
  id TEXT PRIMARY KEY, -- App slug/identifier
  private_key TEXT, -- RSA private key for code signing (optional)
  certificate TEXT, -- RSA certificate for code signing (optional)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional metadata for apps
  name TEXT, -- Human-readable app name
  description TEXT, -- App description
  owner_email TEXT, -- Owner contact
  
  UNIQUE(id)
);

-- Create indexes
CREATE INDEX idx_apps_created_at ON apps(created_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER apps_updated_at 
  AFTER UPDATE ON apps
BEGIN
  UPDATE apps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END; 