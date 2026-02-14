import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { NodesModule } from '../nodes/nodes.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { AgentRunnerController } from './agent-runner.controller';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';

@Module({
  imports: [CanvasModule, NodesModule, CollaborationModule],
  controllers: [AgentRunnerController],
  providers: [AgentRunnerService, AgentSessionRepository],
  exports: [AgentRunnerService],
})
export class AgentModule {}
