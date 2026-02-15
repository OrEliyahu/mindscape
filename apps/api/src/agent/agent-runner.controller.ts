import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';
import { InternalApiGuard } from './internal-api.guard';
import { listPersonas } from './agent-registry';
import { CanvasIdParamDto, CanvasSessionParamDto } from '../common/dto/uuid-param.dto';
import { InvokeAgentDto } from './dto/invoke-agent.dto';

/**
 * REST endpoints for AI agent operations on a canvas.
 *
 * - POST (invoke) is **internal-only** — guarded by `x-internal-key`.
 *   Agents are triggered by backend processes, not by viewers.
 * - GET endpoints are public so viewers can read session history.
 */
@Controller('canvases/:canvasId/agent')
export class AgentRunnerController {
  constructor(
    private readonly runner: AgentRunnerService,
    private readonly sessions: AgentSessionRepository,
  ) {}

  /**
   * Invoke an agent on this canvas.
   * Internal only — requires `x-internal-key` header.
   */
  @Post('invoke')
  @UseGuards(InternalApiGuard)
  invoke(
    @Param() params: CanvasIdParamDto,
    @Body() body: InvokeAgentDto,
  ) {
    return this.runner.invoke(params.canvasId, body);
  }

  /** List available agent personas (public / viewer-accessible) */
  @Get('personas')
  listPersonas() {
    return listPersonas().map(({ key, name, emoji, color, description }) => ({
      key, name, emoji, color, description,
    }));
  }

  /** List all agent sessions for a canvas (public / viewer-accessible) */
  @Get('sessions')
  listSessions(@Param() params: CanvasIdParamDto) {
    return this.sessions.findByCanvas(params.canvasId);
  }

  /** Get a specific agent session (public / viewer-accessible) */
  @Get('sessions/:sessionId')
  getSession(@Param() params: CanvasSessionParamDto) {
    return this.sessions.findById(params.sessionId);
  }
}
