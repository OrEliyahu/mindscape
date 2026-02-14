import type { NodePayload, EdgePayload } from '@mindscape/shared';

/** Map a raw DB node row (snake_case) to a NodePayload (camelCase). */
export function toNodePayload(row: Record<string, unknown>): NodePayload {
  return {
    id: row.id as string,
    canvasId: row.canvas_id as string,
    type: row.type as NodePayload['type'],
    positionX: row.position_x as number,
    positionY: row.position_y as number,
    width: row.width as number,
    height: row.height as number,
    rotation: (row.rotation as number) ?? 0,
    zIndex: row.z_index as number,
    content: row.content as Record<string, unknown>,
    style: row.style as Record<string, unknown>,
    locked: (row.locked as boolean) ?? false,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Map a raw DB edge row (snake_case) to an EdgePayload (camelCase). */
export function toEdgePayload(row: Record<string, unknown>): EdgePayload {
  return {
    id: row.id as string,
    canvasId: row.canvas_id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    label: (row.label as string) ?? null,
    style: (row.style as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

/** Map a raw DB canvas row (snake_case) to camelCase. */
export function toCanvasPayload(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    ownerId: (row.owner_id as string) ?? null,
    viewport: row.viewport as { x: number; y: number; zoom: number },
    settings: row.settings as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
