import { Injectable } from '@nestjs/common';
import type { PresenceUser } from '@mindscape/shared';

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#D946EF',
];

interface ConnectedUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
}

@Injectable()
export class PresenceService {
  private rooms = new Map<string, Map<string, ConnectedUser>>();
  private colorIndex = 0;

  addUser(canvasId: string, socketId: string, userId: string, name: string): PresenceUser[] {
    if (!this.rooms.has(canvasId)) {
      this.rooms.set(canvasId, new Map());
    }

    const room = this.rooms.get(canvasId)!;
    const color = COLORS[this.colorIndex++ % COLORS.length];

    room.set(socketId, {
      socketId,
      userId,
      name,
      color,
      cursorX: 0,
      cursorY: 0,
    });

    return this.getUsers(canvasId);
  }

  removeUser(socketId: string): { canvasId: string; users: PresenceUser[] } | null {
    for (const [canvasId, room] of this.rooms) {
      if (room.has(socketId)) {
        room.delete(socketId);
        if (room.size === 0) {
          this.rooms.delete(canvasId);
          return { canvasId, users: [] };
        }
        return { canvasId, users: this.getUsers(canvasId) };
      }
    }
    return null;
  }

  updateCursor(socketId: string, canvasId: string, x: number, y: number): ConnectedUser | null {
    const room = this.rooms.get(canvasId);
    if (!room) return null;

    const user = room.get(socketId);
    if (!user) return null;

    user.cursorX = x;
    user.cursorY = y;
    return user;
  }

  getUser(socketId: string, canvasId: string): ConnectedUser | undefined {
    return this.rooms.get(canvasId)?.get(socketId);
  }

  getUsers(canvasId: string): PresenceUser[] {
    const room = this.rooms.get(canvasId);
    if (!room) return [];

    return Array.from(room.values()).map((u) => ({
      id: u.userId,
      name: u.name,
      color: u.color,
      cursorX: u.cursorX,
      cursorY: u.cursorY,
      isAgent: false,
    }));
  }

  getCanvasIdForSocket(socketId: string): string | null {
    for (const [canvasId, room] of this.rooms) {
      if (room.has(socketId)) return canvasId;
    }
    return null;
  }
}
