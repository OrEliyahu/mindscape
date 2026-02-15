import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CanvasOwnerGuard } from '../canvas/canvas-owner.guard';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { NodeOwnerGuard } from './node-owner.guard';

@Module({
  imports: [AuthModule],
  controllers: [NodesController],
  providers: [NodesService, NodeOwnerGuard, CanvasOwnerGuard],
  exports: [NodesService],
})
export class NodesModule {}
