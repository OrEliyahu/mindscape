CREATE TABLE edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id   UUID REFERENCES canvases(id) ON DELETE CASCADE,
  source_id   UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES nodes(id) ON DELETE CASCADE,
  label       TEXT,
  style       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_edges_canvas ON edges(canvas_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
