import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNodeDto {
  @IsString()
  @MaxLength(50)
  type!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(5000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(5000)
  height?: number;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
