import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { NodesModule } from '../nodes/nodes.module';
import { EdgesModule } from '../edges/edges.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { AuthModule } from '../auth/auth.module';
import { AgentRunnerController } from './agent-runner.controller';
import { AgentPromptAdminController } from './agent-prompt-admin.controller';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';
import { AgentSchedulerService } from './agent-scheduler.service';
import { SharedContextRepository } from './shared-context.repository';
import { AgentPromptRepository } from './agent-prompt.repository';
import { AgentPromptService } from './agent-prompt.service';
import { AdminPasswordGuard } from './admin-password.guard';

@Module({
  imports: [CanvasModule, NodesModule, EdgesModule, CollaborationModule, AuthModule],
  controllers: [AgentRunnerController, AgentPromptAdminController],
  providers: [
    AgentRunnerService,
    AgentSessionRepository,
    SharedContextRepository,
    AgentSchedulerService,
    AgentPromptRepository,
    AgentPromptService,
    AdminPasswordGuard,
  ],
  exports: [AgentRunnerService],
})
export class AgentModule {}
