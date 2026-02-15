import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';
import { toCanvasPayload, toNodePayload, toEdgePayload } from '../common/mappers';
import type { NodePayload, EdgePayload } from '@mindscape/shared';

interface SnapshotState {
  nodes: NodePayload[];
  edges: EdgePayload[];
}

interface SnapshotRecord {
  id: string;
  canvas_id: string;
  yjs_state: Buffer;
  version: number;
  created_at: string;
}

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

  async createSnapshot(canvasId: string) {
    const canvas = await this.findOneWithNodes(canvasId);
    const encoded = Buffer.from(JSON.stringify({
      nodes: canvas.nodes,
      edges: canvas.edges,
    }), 'utf8');

    const { rows: versions } = await this.pg.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM snapshots
       WHERE canvas_id = $1`,
      [canvasId],
    );
    const version = versions[0]?.next_version ?? 1;

    const { rows } = await this.pg.query<{ id: string; version: number; created_at: string }>(
      `INSERT INTO snapshots (canvas_id, yjs_state, version)
       VALUES ($1, $2, $3)
       RETURNING id, version, created_at`,
      [canvasId, encoded, version],
    );

    return {
      id: rows[0].id,
      version: rows[0].version,
      createdAt: rows[0].created_at,
    };
  }

  async listSnapshots(canvasId: string, limit = 50) {
    const { rows } = await this.pg.query<{ id: string; version: number; created_at: string }>(
      `SELECT id, version, created_at
       FROM snapshots
       WHERE canvas_id = $1
       ORDER BY version DESC
       LIMIT $2`,
      [canvasId, Math.max(1, Math.min(limit, 200))],
    );

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
    }));
  }

  async getSnapshot(canvasId: string, snapshotId: string) {
    const row = await this.getSnapshotRecord(canvasId, snapshotId);
    const state = this.decodeSnapshot(row.yjs_state);

    return {
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
      ...state,
    };
  }

  async restoreSnapshot(canvasId: string, snapshotId: string) {
    const snapshot = await this.getSnapshot(canvasId, snapshotId);
    const client = await this.pg.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM edges WHERE canvas_id = $1', [canvasId]);
      await client.query('DELETE FROM nodes WHERE canvas_id = $1', [canvasId]);

      for (const node of snapshot.nodes) {
        await client.query(
          `INSERT INTO nodes (
            id, canvas_id, type, position_x, position_y, width, height, rotation,
            z_index, content, style, locked, created_by, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            node.id,
            canvasId,
            node.type,
            node.positionX,
            node.positionY,
            node.width,
            node.height,
            node.rotation,
            node.zIndex,
            JSON.stringify(node.content ?? {}),
            JSON.stringify(node.style ?? {}),
            node.locked,
            node.createdBy,
            node.createdAt,
            node.updatedAt,
          ],
        );
      }

      for (const edge of snapshot.edges) {
        await client.query(
          `INSERT INTO edges (id, canvas_id, source_id, target_id, label, style, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            edge.id,
            canvasId,
            edge.sourceId,
            edge.targetId,
            edge.label,
            JSON.stringify(edge.style ?? {}),
            edge.createdAt,
          ],
        );
      }

      await client.query('UPDATE canvases SET updated_at = NOW() WHERE id = $1', [canvasId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.findOneWithNodes(canvasId);
  }

  async diffSnapshotWithCurrent(canvasId: string, snapshotId: string) {
    const snapshot = await this.getSnapshot(canvasId, snapshotId);
    const current = await this.findOneWithNodes(canvasId);

    const snapshotNodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const currentNodeById = new Map((current.nodes as NodePayload[]).map((node) => [node.id, node]));
    const snapshotEdgeById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
    const currentEdgeById = new Map((current.edges as EdgePayload[]).map((edge) => [edge.id, edge]));

    const nodeAdded = Array.from(currentNodeById.keys()).filter((id) => !snapshotNodeById.has(id));
    const nodeRemoved = Array.from(snapshotNodeById.keys()).filter((id) => !currentNodeById.has(id));
    const edgeAdded = Array.from(currentEdgeById.keys()).filter((id) => !snapshotEdgeById.has(id));
    const edgeRemoved = Array.from(snapshotEdgeById.keys()).filter((id) => !currentEdgeById.has(id));

    const nodeUpdated = Array.from(currentNodeById.entries())
      .filter(([id, node]) => {
        const prev = snapshotNodeById.get(id);
        if (!prev) return false;
        return JSON.stringify(prev) !== JSON.stringify(node);
      })
      .map(([id]) => id);

    const edgeUpdated = Array.from(currentEdgeById.entries())
      .filter(([id, edge]) => {
        const prev = snapshotEdgeById.get(id);
        if (!prev) return false;
        return JSON.stringify(prev) !== JSON.stringify(edge);
      })
      .map(([id]) => id);

    return {
      snapshotId: snapshot.id,
      version: snapshot.version,
      nodeAdded,
      nodeRemoved,
      nodeUpdated,
      edgeAdded,
      edgeRemoved,
      edgeUpdated,
    };
  }

  private async getSnapshotRecord(canvasId: string, snapshotId: string): Promise<SnapshotRecord> {
    const { rows } = await this.pg.query<SnapshotRecord>(
      `SELECT id, canvas_id, yjs_state, version, created_at
       FROM snapshots
       WHERE canvas_id = $1 AND id = $2`,
      [canvasId, snapshotId],
    );
    if (!rows.length) {
      throw new NotFoundException('Snapshot not found');
    }
    return rows[0];
  }

  private decodeSnapshot(value: Buffer): SnapshotState {
    const parsed = JSON.parse(value.toString('utf8')) as SnapshotState;
    return {
      nodes: parsed.nodes ?? [],
      edges: parsed.edges ?? [],
    };
  }
}
