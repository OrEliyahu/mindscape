import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { NodesModule } from '../nodes/nodes.module';
import { EdgesModule } from '../edges/edges.module';
import { CollaborationGateway } from './collaboration.gateway';
import { PresenceService } from './presence.service';
import { AgentBroadcastService } from './agent-broadcast.service';

@Module({
  imports: [CanvasModule, NodesModule, EdgesModule],
  providers: [CollaborationGateway, PresenceService, AgentBroadcastService],
  exports: [AgentBroadcastService, PresenceService],
})
export class CollaborationModule {}
