CREATE TABLE canvas_shared_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'theme',
    'intention',
    'contribution',
    'request',
    'reaction'
  )),
  content JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_context_canvas ON canvas_shared_context(canvas_id);
CREATE INDEX idx_shared_context_type ON canvas_shared_context(canvas_id, entry_type);
