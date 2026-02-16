import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';

@Controller('canvases/:canvasId/snapshots')
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotService) {}

  /** List all snapshots for a canvas (viewer-accessible). */
  @Get()
  list(@Param('canvasId') canvasId: string) {
    return this.snapshots.listByCanvas(canvasId);
  }

  /** Get a specific snapshot by ID. */
  @Get(':snapshotId')
  getOne(@Param('snapshotId') snapshotId: string) {
    return this.snapshots.getById(snapshotId);
  }

  /** Get a snapshot by version number. */
  @Get('version/:version')
  getByVersion(
    @Param('canvasId') canvasId: string,
    @Param('version') version: string,
  ) {
    return this.snapshots.getByVersion(canvasId, parseInt(version, 10));
  }

  /** Manually capture a snapshot (internal use). */
  @Post()
  capture(
    @Param('canvasId') canvasId: string,
    @Body() body: { label?: string },
  ) {
    return this.snapshots.capture(canvasId, { label: body.label });
  }

  /** Diff between two snapshot versions. */
  @Get('diff')
  diff(
    @Param('canvasId') canvasId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.snapshots.diff(canvasId, parseInt(from, 10), parseInt(to, 10));
  }
}
