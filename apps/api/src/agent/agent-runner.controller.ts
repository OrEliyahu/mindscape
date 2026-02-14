import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';
import { InternalApiGuard } from './internal-api.guard';
import type { AgentInvokePayload } from '@mindscape/shared';

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
    @Param('canvasId') canvasId: string,
    @Body() body: AgentInvokePayload,
  ) {
    return this.runner.invoke(canvasId, body);
  }

  /** List all agent sessions for a canvas (public / viewer-accessible) */
  @Get('sessions')
  listSessions(@Param('canvasId') canvasId: string) {
    return this.sessions.findByCanvas(canvasId);
  }

  /** Get a specific agent session (public / viewer-accessible) */
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.sessions.findById(sessionId);
  }
}
