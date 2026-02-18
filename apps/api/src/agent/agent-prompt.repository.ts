import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';

export interface AgentPromptConfigRecord {
  personaKey: string;
  baseInstructions: string | null;
  systemPromptSuffix: string | null;
  schedulerPrompts: string[] | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RowShape {
  persona_key: string;
  base_instructions: string | null;
  system_prompt_suffix: string | null;
  scheduler_prompts: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AgentPromptRepository {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async findAll(): Promise<AgentPromptConfigRecord[]> {
    const { rows } = await this.pg.query<RowShape>(
      `SELECT persona_key, base_instructions, system_prompt_suffix, scheduler_prompts, updated_by, created_at, updated_at
       FROM agent_prompt_configs`,
    );
    return rows.map(this.mapRow);
  }

  async upsert(input: {
    personaKey: string;
    baseInstructions?: string | null;
    systemPromptSuffix?: string | null;
    schedulerPrompts?: string[] | null;
    updatedBy?: string | null;
  }): Promise<AgentPromptConfigRecord> {
    const { rows } = await this.pg.query<RowShape>(
      `INSERT INTO agent_prompt_configs (
        persona_key, base_instructions, system_prompt_suffix, scheduler_prompts, updated_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (persona_key)
      DO UPDATE SET
        base_instructions = COALESCE(EXCLUDED.base_instructions, agent_prompt_configs.base_instructions),
        system_prompt_suffix = COALESCE(EXCLUDED.system_prompt_suffix, agent_prompt_configs.system_prompt_suffix),
        scheduler_prompts = COALESCE(EXCLUDED.scheduler_prompts, agent_prompt_configs.scheduler_prompts),
        updated_by = COALESCE(EXCLUDED.updated_by, agent_prompt_configs.updated_by),
        updated_at = NOW()
      RETURNING persona_key, base_instructions, system_prompt_suffix, scheduler_prompts, updated_by, created_at, updated_at`,
      [
        input.personaKey,
        input.baseInstructions ?? null,
        input.systemPromptSuffix ?? null,
        input.schedulerPrompts ? JSON.stringify(input.schedulerPrompts) : null,
        input.updatedBy ?? null,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async remove(personaKey: string): Promise<void> {
    await this.pg.query(`DELETE FROM agent_prompt_configs WHERE persona_key = $1`, [personaKey]);
  }

  private mapRow(row: RowShape): AgentPromptConfigRecord {
    return {
      personaKey: row.persona_key,
      baseInstructions: row.base_instructions,
      systemPromptSuffix: row.system_prompt_suffix,
      schedulerPrompts: Array.isArray(row.scheduler_prompts)
        ? row.scheduler_prompts.filter((value): value is string => typeof value === 'string')
        : null,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
