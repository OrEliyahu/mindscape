import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AgentSessionRepository } from './agent-session.repository';
import type { AgentInvokePayload } from '@mindscape/shared';

/**
 * REST endpoints for invoking and querying AI agents on a canvas.
 *
 * Agents run in the background — the POST returns immediately with a
 * session ID. Progress is streamed to viewers via WebSocket.
 */
@Controller('canvases/:canvasId/agent')
export class AgentRunnerController {
  constructor(
    private readonly runner: AgentRunnerService,
    private readonly sessions: AgentSessionRepository,
  ) {}

  /** Invoke an agent on this canvas */
  @Post('invoke')
  invoke(
    @Param('canvasId') canvasId: string,
    @Body() body: AgentInvokePayload,
  ) {
    return this.runner.invoke(canvasId, body);
  }

  /** List all agent sessions for a canvas */
  @Get('sessions')
  listSessions(@Param('canvasId') canvasId: string) {
    return this.sessions.findByCanvas(canvasId);
  }

  /** Get a specific agent session */
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.sessions.findById(sessionId);
  }
}
