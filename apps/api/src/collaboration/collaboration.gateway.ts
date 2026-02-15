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
import { NodesService } from '../nodes/nodes.service';
import { EdgesService } from '../edges/edges.service';
import { PresenceService } from './presence.service';
import { AgentBroadcastService } from './agent-broadcast.service';
import { toNodePayload, toEdgePayload } from '../common/mappers';
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
    private readonly nodesService: NodesService,
    private readonly edgesService: EdgesService,
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
    @MessageBody() data: { canvasId: string; viewport?: { x: number; y: number; w: number; h: number; zoom: number } },
  ) {
    const { canvasId } = data;
    await client.join(canvasId);

    const userId = (client.handshake.auth as Record<string, string>).userId ?? client.id;
    const name = (client.handshake.auth as Record<string, string>).name ?? 'Viewer';

    const users = this.presenceService.addViewer(canvasId, client.id, userId, name);

    await this.emitViewportState(client, canvasId, data.viewport);

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
  async handleViewportUpdate(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { x: number; y: number; w: number; h: number; zoom: number },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;
    await this.emitViewportState(client, canvasId, data);
  }

  private async emitViewportState(
    client: TypedSocket,
    canvasId: string,
    viewport?: { x: number; y: number; w: number; h: number; zoom: number },
  ) {
    if (!viewport) {
      const canvas = await this.canvasService.findOneWithNodes(canvasId);
      client.emit('canvas:state', {
        nodes: canvas.nodes as NodePayload[],
        edges: canvas.edges as EdgePayload[],
      });
      return;
    }

    const rows = await this.nodesService.findInViewport(canvasId, viewport.x, viewport.y, viewport.w, viewport.h);
    const nodes = rows.map(toNodePayload);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = (await this.edgesService.findByCanvas(canvasId))
      .map(toEdgePayload)
      .filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId));

    client.emit('canvas:state', { nodes, edges });
  }
}
