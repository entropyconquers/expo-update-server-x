-- Migration: Add metadata column to uploads table
-- This stores the extracted metadata.json content for manifest generation
 
ALTER TABLE uploads ADD COLUMN metadata TEXT; 