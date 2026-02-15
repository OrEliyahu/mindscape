import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { UuidParamDto } from '../common/dto/uuid-param.dto';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CanvasOwnerGuard } from './canvas-owner.guard';

@Controller('canvases')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  findAll() {
    return this.canvasService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateCanvasDto, @CurrentUser() user: AuthenticatedUser) {
    return this.canvasService.create(body.title, user.sub);
  }

  @Get(':id')
  findOne(@Param() params: UuidParamDto) {
    return this.canvasService.findOneWithNodes(params.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CanvasOwnerGuard)
  update(@Param() params: UuidParamDto, @Body() body: UpdateCanvasDto) {
    if (!Object.keys(body).length) {
      throw new BadRequestException('Update payload cannot be empty');
    }
    return this.canvasService.update(params.id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CanvasOwnerGuard)
  remove(@Param() params: UuidParamDto) {
    return this.canvasService.remove(params.id);
  }
}
