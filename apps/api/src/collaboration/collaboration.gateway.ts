import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CanvasService } from '../canvas/canvas.service';
import { PresenceService } from './presence.service';
import { AgentBroadcastService } from './agent-broadcast.service';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  NodePayload,
  EdgePayload,
} from '@mindscape/shared';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/* ── DB row → camelCase payload mappers ────────────── */
function toNodePayload(row: Record<string, unknown>): NodePayload {
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

function toEdgePayload(row: Record<string, unknown>): EdgePayload {
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

/**
 * WebSocket gateway for real-time canvas viewing.
 *
 * **Architecture note**: Clients are read-only viewers. They connect,
 * join a canvas room, and receive live updates. All canvas mutations
 * (node create / update / delete) originate from backend agents and
 * are broadcast through the {@link AgentBroadcastService}.
 */
@WebSocketGateway({
  namespace: '/canvas',
  cors: {
    origin: process.env.WS_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: TypedServer;

  private readonly logger = new Logger(CollaborationGateway.name);

  constructor(
    private readonly canvasService: CanvasService,
    private readonly presenceService: PresenceService,
    private readonly agentBroadcast: AgentBroadcastService,
  ) {}

  afterInit(server: TypedServer) {
    // Hand the live server reference to AgentBroadcastService so
    // backend agents can emit events without coupling to Socket.IO.
    this.agentBroadcast.setServer(server);
    this.logger.log('WebSocket gateway initialised – AgentBroadcastService ready');
  }

  /* ──────────────────── connection lifecycle ──────────────── */

  handleConnection(client: TypedSocket) {
    this.logger.log(`Viewer connected: ${client.id}`);
  }

  handleDisconnect(client: TypedSocket) {
    this.logger.log(`Viewer disconnected: ${client.id}`);
    const result = this.presenceService.removeViewer(client.id);
    if (result) {
      this.server.to(result.canvasId).emit('presence:update', { users: result.users });
    }
  }

  /* ──────────────────── client events (read-only) ─────────── */

  @SubscribeMessage('join-canvas')
  async handleJoinCanvas(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { canvasId: string },
  ) {
    const { canvasId } = data;
    await client.join(canvasId);

    const userId = (client.handshake.auth as Record<string, string>).userId ?? client.id;
    const name = (client.handshake.auth as Record<string, string>).name ?? 'Viewer';

    const users = this.presenceService.addViewer(canvasId, client.id, userId, name);

    // Send current canvas state to the newly-joined viewer
    const canvas = await this.canvasService.findOneWithNodes(canvasId);
    client.emit('canvas:state', {
      nodes: (canvas.nodes as Record<string, unknown>[]).map(toNodePayload),
      edges: (canvas.edges as Record<string, unknown>[]).map(toEdgePayload),
    });

    // Notify everyone in the room about updated viewer list
    this.server.to(canvasId).emit('presence:update', { users });
  }

  @SubscribeMessage('leave-canvas')
  async handleLeaveCanvas(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { canvasId: string },
  ) {
    await client.leave(data.canvasId);
    const result = this.presenceService.removeViewer(client.id);
    if (result) {
      this.server.to(result.canvasId).emit('presence:update', { users: result.users });
    }
  }

  @SubscribeMessage('viewport:update')
  handleViewportUpdate(
    @ConnectedSocket() _client: TypedSocket,
    @MessageBody() _data: { x: number; y: number; w: number; h: number; zoom: number },
  ) {
    // Placeholder for future viewport-based culling optimisation.
    // Agents may use this to know which area the viewer is watching.
  }
}
