CREATE TABLE snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id   UUID REFERENCES canvases(id) ON DELETE CASCADE,
  yjs_state   BYTEA NOT NULL,
  version     INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_canvas_version ON snapshots(canvas_id, version DESC);
