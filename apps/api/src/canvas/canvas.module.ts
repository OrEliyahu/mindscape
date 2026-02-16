import { Module } from '@nestjs/common';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';

@Module({
  controllers: [CanvasController, SnapshotController],
  providers: [CanvasService, SnapshotService],
  exports: [CanvasService, SnapshotService],
})
export class CanvasModule {}
