import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';

@Injectable()
export class NodesService {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async create(canvasId: string, data: {
    type: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    content?: Record<string, unknown>;
    style?: Record<string, unknown>;
    createdBy?: string;
  }) {
    const { rows } = await this.pg.query(
      `INSERT INTO nodes (canvas_id, type, position_x, position_y, width, height, content, style, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        canvasId,
        data.type,
        data.positionX ?? 0,
        data.positionY ?? 0,
        data.width ?? 200,
        data.height ?? 200,
        JSON.stringify(data.content ?? {}),
        JSON.stringify(data.style ?? {}),
        data.createdBy ?? null,
      ],
    );
    return rows[0];
  }

  async findByCanvas(canvasId: string) {
    const { rows } = await this.pg.query(
      `SELECT * FROM nodes WHERE canvas_id = $1 ORDER BY z_index ASC`,
      [canvasId],
    );
    return rows;
  }

  async findInViewport(canvasId: string, x: number, y: number, w: number, h: number) {
    const { rows } = await this.pg.query(
      `SELECT * FROM nodes
       WHERE canvas_id = $1
         AND position_x + width >= $2
         AND position_x <= $2 + $4
         AND position_y + height >= $3
         AND position_y <= $3 + $5
       ORDER BY z_index ASC`,
      [canvasId, x, y, w, h],
    );
    return rows;
  }

  async update(id: string, patch: Record<string, unknown>) {
    const fieldMap: Record<string, string> = {
      positionX: 'position_x',
      positionY: 'position_y',
      zIndex: 'z_index',
      createdBy: 'created_by',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(patch)) {
      const column = fieldMap[key] ?? key;
      if (['content', 'style'].includes(column)) {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(value);
      }
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await this.pg.query(
      `UPDATE nodes SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (!rows.length) throw new NotFoundException('Node not found');
    return rows[0];
  }

  async remove(id: string) {
    const { rowCount } = await this.pg.query(`DELETE FROM nodes WHERE id = $1`, [id]);
    if (!rowCount) throw new NotFoundException('Node not found');
    return { deleted: true };
  }

  async batch(canvasId: string, operations: Array<{ action: 'create' | 'update' | 'delete'; data: Record<string, unknown> }>) {
    const results = [];
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');
      for (const op of operations) {
        switch (op.action) {
          case 'create':
            results.push(await this.create(canvasId, op.data as any));
            break;
          case 'update':
            results.push(await this.update(op.data.id as string, op.data));
            break;
          case 'delete':
            results.push(await this.remove(op.data.id as string));
            break;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return results;
  }
}
