import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';
import type { AgentStatus } from '@mindscape/shared';

export interface AgentSessionRow {
  id: string;
  canvas_id: string;
  agent_name: string;
  model: string;
  status: AgentStatus;
  context: Record<string, unknown>;
  tool_calls: unknown[];
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AgentSessionRepository {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async create(canvasId: string, agentName: string, model: string): Promise<AgentSessionRow> {
    const { rows } = await this.pg.query<AgentSessionRow>(
      `INSERT INTO agent_sessions (canvas_id, agent_name, model, status)
       VALUES ($1, $2, $3, 'thinking')
       RETURNING *`,
      [canvasId, agentName, model],
    );
    return rows[0];
  }

  async updateStatus(id: string, status: AgentStatus): Promise<void> {
    await this.pg.query(
      `UPDATE agent_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  async appendToolCall(id: string, toolCall: { tool: string; args: unknown; result: unknown }): Promise<void> {
    await this.pg.query(
      `UPDATE agent_sessions
       SET tool_calls = tool_calls || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ ...toolCall, timestamp: new Date().toISOString() }]), id],
    );
  }

  async findById(id: string): Promise<AgentSessionRow | null> {
    const { rows } = await this.pg.query<AgentSessionRow>(
      `SELECT * FROM agent_sessions WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByCanvas(canvasId: string): Promise<AgentSessionRow[]> {
    const { rows } = await this.pg.query<AgentSessionRow>(
      `SELECT * FROM agent_sessions WHERE canvas_id = $1 ORDER BY created_at DESC`,
      [canvasId],
    );
    return rows;
  }
}
