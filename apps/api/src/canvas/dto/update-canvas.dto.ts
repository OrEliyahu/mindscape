import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCanvasDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
