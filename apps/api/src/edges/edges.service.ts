import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';

@Injectable()
export class EdgesService {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async create(canvasId: string, data: {
    sourceId: string;
    targetId: string;
    label?: string;
    style?: Record<string, unknown>;
  }) {
    const { rows } = await this.pg.query(
      `INSERT INTO edges (canvas_id, source_id, target_id, label, style)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        canvasId,
        data.sourceId,
        data.targetId,
        data.label ?? null,
        JSON.stringify(data.style ?? {}),
      ],
    );
    return rows[0];
  }

  async findByCanvas(canvasId: string) {
    const { rows } = await this.pg.query(
      `SELECT * FROM edges WHERE canvas_id = $1`,
      [canvasId],
    );
    return rows;
  }

  async remove(id: string) {
    const { rowCount } = await this.pg.query(`DELETE FROM edges WHERE id = $1`, [id]);
    if (!rowCount) throw new NotFoundException('Edge not found');
    return { deleted: true };
  }
}
