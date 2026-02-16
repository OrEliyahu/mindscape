import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  NodePayload,
  EdgePayload,
  AgentStatus,
  CollaborationEventType,
} from '@mindscape/shared';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Service used by **backend agents** to broadcast canvas mutations
 * to all connected viewers in a room.
 *
 * This is the write-side of the real-time pipeline:
 *   Agent → NodesService (DB) → AgentBroadcastService → Socket.IO → Viewers
 *
 * Inject this service into any agent/runner that modifies the canvas
 * and call the appropriate broadcast method after persisting the change.
 */
@Injectable()
export class AgentBroadcastService {
  private readonly logger = new Logger(AgentBroadcastService.name);
  private server: TypedServer | null = null;

  /**
   * Called by the gateway once the Socket.IO server is initialised.
   * We hold a reference so agents can emit without being Socket.IO-aware.
   */
  setServer(server: TypedServer) {
    this.server = server;
    this.logger.log('Socket.IO server reference acquired');
  }

  /* ──────────────────── node broadcasts ──────────────────── */

  broadcastNodeCreated(canvasId: string, node: NodePayload) {
    this.emit(canvasId, 'node:created', { node });
  }

  broadcastNodeUpdated(canvasId: string, id: string, patch: Partial<NodePayload>) {
    this.emit(canvasId, 'node:updated', { id, patch });
  }

  broadcastNodeDeleted(canvasId: string, id: string) {
    this.emit(canvasId, 'node:deleted', { id });
  }

  /* ──────────────────── edge broadcasts ──────────────────── */

  broadcastEdgeCreated(canvasId: string, edge: EdgePayload) {
    this.emit(canvasId, 'edge:created', { edge });
  }

  broadcastEdgeDeleted(canvasId: string, id: string) {
    this.emit(canvasId, 'edge:deleted', { id });
  }

  /* ──────────────────── agent activity ────────────────────── */

  broadcastAgentStatus(canvasId: string, sessionId: string, status: AgentStatus) {
    this.emit(canvasId, 'agent:status', { sessionId, status });
  }

  broadcastAgentThought(canvasId: string, sessionId: string, text: string) {
    this.emit(canvasId, 'agent:thought', { sessionId, text });
  }

  broadcastAgentToolCall(canvasId: string, sessionId: string, tool: string, args: unknown, result: unknown) {
    this.emit(canvasId, 'agent:tool-call', { sessionId, tool, args, result });
  }

  broadcastAgentCursor(canvasId: string, sessionId: string, x: number, y: number) {
    this.emit(canvasId, 'agent:cursor', { sessionId, x, y });
  }

  broadcastAgentError(canvasId: string, sessionId: string, error: string) {
    this.emit(canvasId, 'agent:error', { sessionId, error });
  }

  broadcastAgentCollaboration(
    canvasId: string,
    sessionId: string,
    payload: {
      type: CollaborationEventType;
      fromAgent: string;
      toAgent?: string;
      summary: string;
    },
  ) {
    this.emit(canvasId, 'agent:collaboration', { sessionId, ...payload });
  }

  /* ──────────────────── internal helper ──────────────────── */

  private emit<E extends keyof ServerToClientEvents>(
    canvasId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    if (!this.server) {
      this.logger.warn(`Cannot emit "${String(event)}" – server not initialised`);
      return;
    }
    this.server.to(canvasId).emit(event, ...args);
  }
}
