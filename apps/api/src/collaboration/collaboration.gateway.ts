import { Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { CanvasService } from '../canvas/canvas.service';
import { NodesService } from '../nodes/nodes.service';
import { PresenceService } from './presence.service';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  CreateNodePayload,
  NodePayload,
  EdgePayload,
} from '@mindscape/shared';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const CURSOR_CHANNEL = 'mindscape:cursors';

@WebSocketGateway({
  namespace: '/canvas',
  cors: {
    origin: process.env.WS_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: TypedServer;

  private readonly logger = new Logger(CollaborationGateway.name);
  private subscriber: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly canvasService: CanvasService,
    private readonly nodesService: NodesService,
    private readonly presenceService: PresenceService,
  ) {
    this.subscriber = this.redis.duplicate();
    this.initRedisSub();
  }

  private initRedisSub() {
    this.subscriber.subscribe(CURSOR_CHANNEL);
    this.subscriber.on('message', (_channel: string, message: string) => {
      const data = JSON.parse(message) as {
        canvasId: string;
        excludeSocketId: string;
        payload: { userId: string; x: number; y: number; name: string; color: string };
      };
      this.server
        .to(data.canvasId)
        .except(data.excludeSocketId)
        .emit('cursor:moved', data.payload);
    });
  }

  handleConnection(client: TypedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: TypedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const result = this.presenceService.removeUser(client.id);
    if (result) {
      this.server.to(result.canvasId).emit('presence:update', { users: result.users });
    }
  }

  @SubscribeMessage('join-canvas')
  async handleJoinCanvas(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { canvasId: string },
  ) {
    const { canvasId } = data;

    await client.join(canvasId);

    const userId = (client.handshake.auth as Record<string, string>).userId ?? client.id;
    const name = (client.handshake.auth as Record<string, string>).name ?? 'Anonymous';

    const users = this.presenceService.addUser(canvasId, client.id, userId, name);

    const canvas = await this.canvasService.findOneWithNodes(canvasId);

    client.emit('canvas:state', {
      nodes: canvas.nodes as NodePayload[],
      edges: canvas.edges as EdgePayload[],
    });

    this.server.to(canvasId).emit('presence:update', { users });
  }

  @SubscribeMessage('leave-canvas')
  async handleLeaveCanvas(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { canvasId: string },
  ) {
    await client.leave(data.canvasId);
    const result = this.presenceService.removeUser(client.id);
    if (result) {
      this.server.to(result.canvasId).emit('presence:update', { users: result.users });
    }
  }

  @SubscribeMessage('node:create')
  async handleNodeCreate(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { node: CreateNodePayload },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;

    const node = await this.nodesService.create(canvasId, data.node);
    client.to(canvasId).emit('node:created', { node });
  }

  @SubscribeMessage('node:update')
  async handleNodeUpdate(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { id: string; patch: Partial<NodePayload> },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;

    await this.nodesService.update(data.id, data.patch);
    client.to(canvasId).emit('node:updated', { id: data.id, patch: data.patch });
  }

  @SubscribeMessage('node:delete')
  async handleNodeDelete(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { id: string },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;

    await this.nodesService.remove(data.id);
    client.to(canvasId).emit('node:deleted', { id: data.id });
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { x: number; y: number },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;

    const user = this.presenceService.updateCursor(client.id, canvasId, data.x, data.y);
    if (!user) return;

    await this.redis.publish(
      CURSOR_CHANNEL,
      JSON.stringify({
        canvasId,
        excludeSocketId: client.id,
        payload: {
          userId: user.userId,
          x: data.x,
          y: data.y,
          name: user.name,
          color: user.color,
        },
      }),
    );
  }

  @SubscribeMessage('selection:change')
  handleSelectionChange(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { nodeIds: string[] },
  ) {
    const canvasId = this.presenceService.getCanvasIdForSocket(client.id);
    if (!canvasId) return;

    const user = this.presenceService.getUser(client.id, canvasId);
    if (!user) return;

    client.to(canvasId).emit('selection:changed', {
      userId: user.userId,
      nodeIds: data.nodeIds,
    });
  }
}
