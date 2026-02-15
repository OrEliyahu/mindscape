import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { BatchOperationsDto } from './dto/batch-operations.dto';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { ViewportQueryDto } from './dto/viewport-query.dto';
import { CanvasIdParamDto, UuidParamDto } from '../common/dto/uuid-param.dto';

@Controller()
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post('canvases/:canvasId/nodes')
  create(
    @Param() params: CanvasIdParamDto,
    @Body() body: CreateNodeDto,
  ) {
    return this.nodesService.create(params.canvasId, body);
  }

  @Get('canvases/:canvasId/nodes')
  findByCanvas(
    @Param() params: CanvasIdParamDto,
    @Query() query: ViewportQueryDto,
  ) {
    if (query.viewport) {
      const [x, y, w, h] = query.viewport.split(',').map(Number);
      return this.nodesService.findInViewport(params.canvasId, x, y, w, h);
    }
    return this.nodesService.findByCanvas(params.canvasId);
  }

  @Patch('nodes/:id')
  update(@Param() params: UuidParamDto, @Body() body: UpdateNodeDto) {
    if (!Object.keys(body).length) {
      throw new BadRequestException('Update payload cannot be empty');
    }
    return this.nodesService.update(params.id, { ...body });
  }

  @Delete('nodes/:id')
  remove(@Param() params: UuidParamDto) {
    return this.nodesService.remove(params.id);
  }

  @Post('canvases/:canvasId/nodes/batch')
  batch(
    @Param() params: CanvasIdParamDto,
    @Body() body: BatchOperationsDto,
  ) {
    if (!body.operations.length) {
      throw new BadRequestException('Batch operations cannot be empty');
    }
    return this.nodesService.batch(params.canvasId, body.operations);
  }
}
