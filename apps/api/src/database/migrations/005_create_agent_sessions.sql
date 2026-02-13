CREATE TABLE agent_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id   UUID REFERENCES canvases(id) ON DELETE CASCADE,
  agent_name  TEXT NOT NULL,
  model       TEXT NOT NULL,
  status      TEXT DEFAULT 'idle' CHECK (status IN ('idle','thinking','acting','error')),
  context     JSONB DEFAULT '{}',
  tool_calls  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
