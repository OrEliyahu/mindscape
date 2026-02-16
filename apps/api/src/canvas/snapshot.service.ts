import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';
import { toNodePayload, toEdgePayload } from '../common/mappers';

export interface SnapshotRow {
  id: string;
  canvas_id: string;
  version: number;
  label: string | null;
  session_id: string | null;
  data: { nodes: unknown[]; edges: unknown[] };
  created_at: string;
}

export interface SnapshotSummary {
  id: string;
  canvasId: string;
  version: number;
  label: string | null;
  sessionId: string | null;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
}

function toSnapshotSummary(row: SnapshotRow): SnapshotSummary {
  return {
    id: row.id,
    canvasId: row.canvas_id,
    version: row.version,
    label: row.label,
    sessionId: row.session_id,
    nodeCount: row.data?.nodes?.length ?? 0,
    edgeCount: row.data?.edges?.length ?? 0,
    createdAt: row.created_at,
  };
}

@Injectable()
export class SnapshotService {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  /**
   * Capture the current canvas state as a snapshot.
   * Stores all nodes and edges as a JSON blob.
   */
  async capture(canvasId: string, opts?: { label?: string; sessionId?: string }): Promise<SnapshotSummary> {
    // Get next version number
    const { rows: versionRows } = await this.pg.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM snapshots WHERE canvas_id = $1`,
      [canvasId],
    );
    const nextVersion = versionRows[0].next_version as number;

    // Fetch current nodes and edges
    const { rows: nodes } = await this.pg.query(
      `SELECT * FROM nodes WHERE canvas_id = $1 ORDER BY z_index ASC`,
      [canvasId],
    );
    const { rows: edges } = await this.pg.query(
      `SELECT * FROM edges WHERE canvas_id = $1`,
      [canvasId],
    );

    const data = {
      nodes: nodes.map(toNodePayload),
      edges: edges.map(toEdgePayload),
    };

    const { rows } = await this.pg.query<SnapshotRow>(
      `INSERT INTO snapshots (canvas_id, version, data, label, session_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        canvasId,
        nextVersion,
        JSON.stringify(data),
        opts?.label ?? null,
        opts?.sessionId ?? null,
      ],
    );

    return toSnapshotSummary(rows[0]);
  }

  /** List all snapshots for a canvas (newest first). */
  async listByCanvas(canvasId: string): Promise<SnapshotSummary[]> {
    const { rows } = await this.pg.query<SnapshotRow>(
      `SELECT * FROM snapshots WHERE canvas_id = $1 ORDER BY version DESC`,
      [canvasId],
    );
    return rows.map(toSnapshotSummary);
  }

  /** Get a specific snapshot with full data (nodes + edges). */
  async getById(id: string) {
    const { rows } = await this.pg.query<SnapshotRow>(
      `SELECT * FROM snapshots WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Snapshot not found');
    const row = rows[0];
    return {
      ...toSnapshotSummary(row),
      data: row.data,
    };
  }

  /** Get a snapshot by canvas + version. */
  async getByVersion(canvasId: string, version: number) {
    const { rows } = await this.pg.query<SnapshotRow>(
      `SELECT * FROM snapshots WHERE canvas_id = $1 AND version = $2`,
      [canvasId, version],
    );
    if (!rows.length) throw new NotFoundException(`Snapshot version ${version} not found`);
    const row = rows[0];
    return {
      ...toSnapshotSummary(row),
      data: row.data,
    };
  }

  /**
   * Compute a diff between two snapshot versions.
   * Returns lists of added, removed, and modified nodes.
   */
  async diff(canvasId: string, fromVersion: number, toVersion: number) {
    const fromSnap = await this.getByVersion(canvasId, fromVersion);
    const toSnap = await this.getByVersion(canvasId, toVersion);

    const fromNodes = new Map((fromSnap.data.nodes as { id: string }[]).map((n) => [n.id, n]));
    const toNodes = new Map((toSnap.data.nodes as { id: string }[]).map((n) => [n.id, n]));

    const added: unknown[] = [];
    const removed: unknown[] = [];
    const modified: { id: string; from: unknown; to: unknown }[] = [];

    // Find added and modified
    for (const [id, node] of toNodes) {
      const prev = fromNodes.get(id);
      if (!prev) {
        added.push(node);
      } else if (JSON.stringify(prev) !== JSON.stringify(node)) {
        modified.push({ id, from: prev, to: node });
      }
    }

    // Find removed
    for (const [id, node] of fromNodes) {
      if (!toNodes.has(id)) {
        removed.push(node);
      }
    }

    return {
      fromVersion,
      toVersion,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      changes: { added, removed, modified },
    };
  }
}
