CREATE TABLE nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id   UUID REFERENCES canvases(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'sticky_note','text_block','image','drawing',
                'code_block','shape','group','ai_response'
              )),
  position_x  DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y  DOUBLE PRECISION NOT NULL DEFAULT 0,
  width       DOUBLE PRECISION NOT NULL DEFAULT 200,
  height      DOUBLE PRECISION NOT NULL DEFAULT 200,
  rotation    DOUBLE PRECISION DEFAULT 0,
  z_index     INTEGER DEFAULT 0,
  content     JSONB NOT NULL DEFAULT '{}',
  style       JSONB DEFAULT '{}',
  locked      BOOLEAN DEFAULT FALSE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_canvas ON nodes(canvas_id);
CREATE INDEX idx_nodes_spatial ON nodes(canvas_id, position_x, position_y);
