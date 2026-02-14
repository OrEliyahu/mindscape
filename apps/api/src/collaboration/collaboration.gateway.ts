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
    // findOneWithNodes already returns mapped camelCase payloads
    const canvas = await this.canvasService.findOneWithNodes(canvasId);
    client.emit('canvas:state', {
      nodes: canvas.nodes as NodePayload[],
      edges: canvas.edges as EdgePayload[],
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
