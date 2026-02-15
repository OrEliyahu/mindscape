import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { sanitizeAgentPrompt } from '../../common/utils/sanitize-agent-prompt';

class AgentViewportDto {
  @Type(() => Number)
  @IsNumber()
  x!: number;

  @Type(() => Number)
  @IsNumber()
  y!: number;

  @Type(() => Number)
  @IsNumber()
  width!: number;

  @Type(() => Number)
  @IsNumber()
  height!: number;

  @Type(() => Number)
  @IsNumber()
  zoom!: number;
}

class AgentContextDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  selectedNodeIds?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentViewportDto)
  viewport?: AgentViewportDto;
}

export class InvokeAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? sanitizeAgentPrompt(value) : value))
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  agentType?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentContextDto)
  context?: AgentContextDto;
}
