import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CanvasService } from './canvas.service';

@Controller('canvases')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  findAll() {
    return this.canvasService.findAll();
  }

  @Post()
  create(@Body() body: { title?: string; ownerId?: string }) {
    return this.canvasService.create(body.title, body.ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.canvasService.findOneWithNodes(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { title?: string; settings?: Record<string, unknown> }) {
    return this.canvasService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.canvasService.remove(id);
  }
}
