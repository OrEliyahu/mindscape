CREATE TABLE IF NOT EXISTS agent_prompt_configs (
  persona_key TEXT PRIMARY KEY,
  base_instructions TEXT,
  system_prompt_suffix TEXT,
  scheduler_prompts JSONB,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_prompt_configs_updated_at
  ON agent_prompt_configs(updated_at DESC);
