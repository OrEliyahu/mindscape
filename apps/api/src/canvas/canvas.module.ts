import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { CanvasOwnerGuard } from './canvas-owner.guard';

@Module({
  imports: [AuthModule],
  controllers: [CanvasController],
  providers: [CanvasService, CanvasOwnerGuard],
  exports: [CanvasService, CanvasOwnerGuard],
})
export class CanvasModule {}
