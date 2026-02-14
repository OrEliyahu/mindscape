import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';
import { toCanvasPayload, toNodePayload, toEdgePayload } from '../common/mappers';

@Injectable()
export class CanvasService {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async findAll() {
    const { rows } = await this.pg.query(
      `SELECT id, title, owner_id, created_at, updated_at FROM canvases ORDER BY updated_at DESC`,
    );
    return rows.map(toCanvasPayload);
  }

  async create(title?: string, ownerId?: string) {
    const { rows } = await this.pg.query(
      `INSERT INTO canvases (title, owner_id) VALUES ($1, $2) RETURNING *`,
      [title ?? 'Untitled Canvas', ownerId ?? null],
    );
    return rows[0];
  }

  async findOneWithNodes(id: string) {
    const { rows: canvases } = await this.pg.query(
      `SELECT * FROM canvases WHERE id = $1`,
      [id],
    );
    if (!canvases.length) throw new NotFoundException('Canvas not found');

    const { rows: nodes } = await this.pg.query(
      `SELECT * FROM nodes WHERE canvas_id = $1 ORDER BY z_index ASC`,
      [id],
    );

    const { rows: edges } = await this.pg.query(
      `SELECT * FROM edges WHERE canvas_id = $1`,
      [id],
    );

    return {
      ...toCanvasPayload(canvases[0]),
      nodes: nodes.map(toNodePayload),
      edges: edges.map(toEdgePayload),
    };
  }

  async update(id: string, patch: { title?: string; settings?: Record<string, unknown> }) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (patch.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(patch.title);
    }
    if (patch.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(patch.settings));
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await this.pg.query(
      `UPDATE canvases SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (!rows.length) throw new NotFoundException('Canvas not found');
    return rows[0];
  }

  async remove(id: string) {
    const { rowCount } = await this.pg.query(`DELETE FROM canvases WHERE id = $1`, [id]);
    if (!rowCount) throw new NotFoundException('Canvas not found');
    return { deleted: true };
  }
}
