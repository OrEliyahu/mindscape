import { Injectable, Logger } from '@nestjs/common';
import type { PresenceUser } from '@mindscape/shared';

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#D946EF',
];

/**
 * Lightweight viewer represented in a canvas room.
 * Visitors are **read-only** — they only watch the canvas.
 */
interface ConnectedViewer {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

/**
 * Tracks which viewers are connected to each canvas room.
 *
 * Viewers never write to the canvas — all mutations come from
 * backend agents. We therefore don't track cursors / selections
 * for human visitors.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  /** canvasId → socketId → viewer */
  private rooms = new Map<string, Map<string, ConnectedViewer>>();
  private colorIndex = 0;

  /* ──────────────────── viewer lifecycle ──────────────────── */

  addViewer(canvasId: string, socketId: string, userId: string, name: string): PresenceUser[] {
    if (!this.rooms.has(canvasId)) {
      this.rooms.set(canvasId, new Map());
    }

    const room = this.rooms.get(canvasId)!;
    const color = COLORS[this.colorIndex++ % COLORS.length];

    room.set(socketId, { socketId, userId, name, color });
    this.logger.log(`Viewer ${name} (${userId}) joined canvas ${canvasId}`);

    return this.getViewers(canvasId);
  }

  removeViewer(socketId: string): { canvasId: string; users: PresenceUser[] } | null {
    for (const [canvasId, room] of this.rooms) {
      if (room.has(socketId)) {
        const viewer = room.get(socketId)!;
        room.delete(socketId);
        this.logger.log(`Viewer ${viewer.name} left canvas ${canvasId}`);

        if (room.size === 0) {
          this.rooms.delete(canvasId);
          return { canvasId, users: [] };
        }
        return { canvasId, users: this.getViewers(canvasId) };
      }
    }
    return null;
  }

  /* ──────────────────── queries ───────────────────────────── */

  getViewers(canvasId: string): PresenceUser[] {
    const room = this.rooms.get(canvasId);
    if (!room) return [];

    return Array.from(room.values()).map((v) => ({
      id: v.userId,
      name: v.name,
      color: v.color,
      cursorX: 0,
      cursorY: 0,
      isAgent: false,
    }));
  }

  getCanvasIdForSocket(socketId: string): string | null {
    for (const [canvasId, room] of this.rooms) {
      if (room.has(socketId)) return canvasId;
    }
    return null;
  }

  /** How many viewers are watching a specific canvas */
  viewerCount(canvasId: string): number {
    return this.rooms.get(canvasId)?.size ?? 0;
  }

  /** All canvas IDs that have at least one connected viewer */
  activeCanvasIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}
