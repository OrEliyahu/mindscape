import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { UuidParamDto } from '../common/dto/uuid-param.dto';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';

@Controller('canvases')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  findAll() {
    return this.canvasService.findAll();
  }

  @Post()
  create(@Body() body: CreateCanvasDto) {
    return this.canvasService.create(body.title, body.ownerId);
  }

  @Get(':id')
  findOne(@Param() params: UuidParamDto) {
    return this.canvasService.findOneWithNodes(params.id);
  }

  @Patch(':id')
  update(@Param() params: UuidParamDto, @Body() body: UpdateCanvasDto) {
    if (!Object.keys(body).length) {
      throw new BadRequestException('Update payload cannot be empty');
    }
    return this.canvasService.update(params.id, body);
  }

  @Delete(':id')
  remove(@Param() params: UuidParamDto) {
    return this.canvasService.remove(params.id);
  }
}
