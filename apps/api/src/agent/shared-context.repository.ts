import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';
import type { SharedContextEntry, SharedContextEntryType } from '@mindscape/shared';

interface SharedContextRow {
  id: string;
  canvas_id: string;
  session_id: string | null;
  agent_name: string;
  entry_type: SharedContextEntryType;
  content: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
}

@Injectable()
export class SharedContextRepository {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async addEntry(
    canvasId: string,
    sessionId: string | null,
    agentName: string,
    entryType: SharedContextEntryType,
    content: Record<string, unknown>,
  ): Promise<SharedContextEntry> {
    const { rows } = await this.pg.query<SharedContextRow>(
      `INSERT INTO canvas_shared_context (canvas_id, session_id, agent_name, entry_type, content)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [canvasId, sessionId, agentName, entryType, JSON.stringify(content)],
    );

    return this.toEntry(rows[0]);
  }

  async getRecentEntries(
    canvasId: string,
    options?: {
      entryType?: SharedContextEntryType;
      limit?: number;
      excludeSessionId?: string;
    },
  ): Promise<SharedContextEntry[]> {
    await this.pruneExpired(canvasId);

    const where: string[] = ['canvas_id = $1'];
    const params: unknown[] = [canvasId];

    if (options?.entryType) {
      params.push(options.entryType);
      where.push(`entry_type = $${params.length}`);
    }

    if (options?.excludeSessionId) {
      params.push(options.excludeSessionId);
      where.push(`(session_id IS NULL OR session_id <> $${params.length})`);
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));
    params.push(limit);

    const { rows } = await this.pg.query<SharedContextRow>(
      `SELECT *
       FROM canvas_shared_context
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row) => this.toEntry(row));
  }

  async getActiveThemes(canvasId: string): Promise<SharedContextEntry[]> {
    return this.getRecentEntries(canvasId, { entryType: 'theme', limit: 20 });
  }

  async getOpenRequests(
    canvasId: string,
    targetPersona?: string,
    excludeSessionId?: string,
  ): Promise<SharedContextEntry[]> {
    const requests = await this.getRecentEntries(canvasId, {
      entryType: 'request',
      limit: 20,
      excludeSessionId,
    });
    if (!targetPersona) return requests;

    return requests.filter((entry) => {
      const target = entry.content.targetPersona;
      return typeof target !== 'string' || target === targetPersona;
    });
  }

  async pruneExpired(canvasId: string): Promise<number> {
    const { rowCount } = await this.pg.query(
      `DELETE FROM canvas_shared_context
       WHERE canvas_id = $1
         AND expires_at IS NOT NULL
         AND expires_at < NOW()`,
      [canvasId],
    );
    return rowCount ?? 0;
  }

  private toEntry(row: SharedContextRow): SharedContextEntry {
    return {
      id: row.id,
      canvasId: row.canvas_id,
      sessionId: row.session_id,
      agentName: row.agent_name,
      entryType: row.entry_type,
      content: row.content,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
