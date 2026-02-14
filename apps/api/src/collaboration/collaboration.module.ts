import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { CollaborationGateway } from './collaboration.gateway';
import { PresenceService } from './presence.service';
import { AgentBroadcastService } from './agent-broadcast.service';

@Module({
  imports: [CanvasModule],
  providers: [CollaborationGateway, PresenceService, AgentBroadcastService],
  exports: [AgentBroadcastService, PresenceService],
})
export class CollaborationModule {}
