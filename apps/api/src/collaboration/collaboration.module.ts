import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { NodesModule } from '../nodes/nodes.module';
import { CollaborationGateway } from './collaboration.gateway';
import { PresenceService } from './presence.service';

@Module({
  imports: [CanvasModule, NodesModule],
  providers: [CollaborationGateway, PresenceService],
})
export class CollaborationModule {}
