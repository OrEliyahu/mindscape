-- Replace yjs_state BYTEA with data JSONB for JSON-based canvas snapshots.
-- Add trigger and label columns for better snapshot management.

ALTER TABLE snapshots
  ADD COLUMN data       JSONB,
  ADD COLUMN label      TEXT,
  ADD COLUMN session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL;

-- Backfill: make data NOT NULL after adding column (no rows exist yet)
UPDATE snapshots SET data = '{}' WHERE data IS NULL;
ALTER TABLE snapshots ALTER COLUMN data SET NOT NULL;
ALTER TABLE snapshots ALTER COLUMN data SET DEFAULT '{}';

-- yjs_state is no longer needed but we keep it nullable for safety
ALTER TABLE snapshots ALTER COLUMN yjs_state DROP NOT NULL;
