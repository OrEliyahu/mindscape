import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { NodesService } from './nodes.service';

@Controller()
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post('canvases/:canvasId/nodes')
  create(
    @Param('canvasId') canvasId: string,
    @Body() body: {
      type: string;
      positionX?: number;
      positionY?: number;
      width?: number;
      height?: number;
      content?: Record<string, unknown>;
      style?: Record<string, unknown>;
      createdBy?: string;
    },
  ) {
    return this.nodesService.create(canvasId, body);
  }

  @Get('canvases/:canvasId/nodes')
  findByCanvas(
    @Param('canvasId') canvasId: string,
    @Query('viewport') viewport?: string,
  ) {
    if (viewport) {
      const [x, y, w, h] = viewport.split(',').map(Number);
      return this.nodesService.findInViewport(canvasId, x, y, w, h);
    }
    return this.nodesService.findByCanvas(canvasId);
  }

  @Patch('nodes/:id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.nodesService.update(id, body);
  }

  @Delete('nodes/:id')
  remove(@Param('id') id: string) {
    return this.nodesService.remove(id);
  }

  @Post('canvases/:canvasId/nodes/batch')
  batch(
    @Param('canvasId') canvasId: string,
    @Body() body: { operations: Array<{ action: 'create' | 'update' | 'delete'; data: Record<string, unknown> }> },
  ) {
    return this.nodesService.batch(canvasId, body.operations);
  }
}
