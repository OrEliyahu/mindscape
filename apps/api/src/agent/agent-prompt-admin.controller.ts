import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AgentPromptService } from './agent-prompt.service';
import { AdminPasswordGuard } from './admin-password.guard';

class UpdateBasePromptDto {
  @IsString()
  @MinLength(40)
  @MaxLength(30000)
  baseInstructions!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  updatedBy?: string;
}

class UpdatePersonaPromptDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  systemPromptSuffix?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schedulerPrompts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  updatedBy?: string;
}

@Controller('admin/agent-prompts')
@UseGuards(AdminPasswordGuard)
export class AgentPromptAdminController {
  constructor(private readonly prompts: AgentPromptService) {}

  @Get()
  getAll() {
    return this.prompts.getAdminView();
  }

  @Patch('base')
  updateBase(@Body() body: UpdateBasePromptDto) {
    return this.prompts.updateBaseInstructions(body.baseInstructions, body.updatedBy);
  }

  @Delete('base')
  resetBase() {
    return this.prompts.resetBaseInstructions();
  }

  @Patch('personas/:personaKey')
  updatePersona(@Param('personaKey') personaKey: string, @Body() body: UpdatePersonaPromptDto) {
    return this.prompts.updatePersonaPrompt(
      personaKey,
      {
        systemPromptSuffix: body.systemPromptSuffix,
        schedulerPrompts: body.schedulerPrompts,
      },
      body.updatedBy,
    );
  }

  @Delete('personas/:personaKey')
  resetPersona(@Param('personaKey') personaKey: string) {
    return this.prompts.resetPersonaPrompt(personaKey);
  }
}
