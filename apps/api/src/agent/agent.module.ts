import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { NodesModule } from '../nodes/nodes.module';
import { EdgesModule } from '../edges/edges.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { AuthModule } from '../auth/auth.module';
import { AgentRunnerController } from './agent-runner.controller';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';
import { AgentSchedulerService } from './agent-scheduler.service';

@Module({
  imports: [CanvasModule, NodesModule, EdgesModule, CollaborationModule, AuthModule],
  controllers: [AgentRunnerController],
  providers: [AgentRunnerService, AgentSessionRepository, AgentSchedulerService],
  exports: [AgentRunnerService],
})
export class AgentModule {}
