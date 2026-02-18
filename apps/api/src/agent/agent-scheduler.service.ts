import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { CanvasService } from '../canvas/canvas.service';
import { AgentRunnerService } from './agent-runner.service';
import { listPersonas } from './agent-registry';
import { SharedContextRepository } from './shared-context.repository';
import { AgentPromptService } from './agent-prompt.service';
import { DEFAULT_SCHEDULER_PROMPT_TEMPLATES } from './agent-prompt-defaults';

const CHECK_INTERVAL_MS = 5000;
const DEFAULT_ACTION_INTERVAL_MS = 45000;

@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name);
  private readonly enabled: boolean;
  private readonly actionIntervalMs: number;
  private lastActionAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly canvasService: CanvasService,
    private readonly agentRunner: AgentRunnerService,
    private readonly sharedContext: SharedContextRepository,
    private readonly promptService: AgentPromptService,
  ) {
    this.enabled = this.configService.get<string>('AGENT_SCHEDULER_ENABLED', 'true') === 'true';
    this.actionIntervalMs = this.configService.get<number>(
      'AGENT_SCHEDULER_INTERVAL_MS',
      DEFAULT_ACTION_INTERVAL_MS,
    );
  }

  @Interval(CHECK_INTERVAL_MS)
  async tick() {
    if (!this.enabled) return;

    const now = Date.now();
    if (this.lastActionAt > 0 && now - this.lastActionAt < this.actionIntervalMs) {
      return;
    }

    const canvases = await this.canvasService.findAll();
    if (canvases.length === 0) return;

    const canvas = canvases[Math.floor(Math.random() * canvases.length)];
    const personas = listPersonas();
    const personaKeys = new Set(personas.map((p) => p.key));
    const openRequests = await this.sharedContext.getOpenRequests(canvas.id);
    const directedRequest = openRequests.find((req) => {
      const target = req.content.targetPersona;
      return typeof target === 'string' && personaKeys.has(target);
    });

    const persona = directedRequest
      ? personas.find((p) => p.key === directedRequest.content.targetPersona)!
      : personas[Math.floor(Math.random() * personas.length)];

    const prompt = directedRequest
      ? this.buildRequestPrompt(directedRequest)
      : await this.pickPrompt(persona.key);

    try {
      await this.agentRunner.invoke(canvas.id, {
        prompt,
        agentType: persona.key,
      });
      this.lastActionAt = now;
      this.logger.debug(`Scheduled ${persona.key} on canvas ${canvas.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Scheduler skipped run on canvas ${canvas.id}: ${message}`);
    }
  }

  private async pickPrompt(personaKey: string): Promise<string> {
    const prompts = await this.promptService.getSchedulerPrompts(personaKey);
    const safePrompts = prompts.length > 0 ? prompts : (DEFAULT_SCHEDULER_PROMPT_TEMPLATES[personaKey]
      ?? DEFAULT_SCHEDULER_PROMPT_TEMPLATES['canvas-agent']);
    const selected = safePrompts[Math.floor(Math.random() * safePrompts.length)];
    if (!selected) {
      return 'Extend the canvas with interesting creative work and check shared context first.';
    }
    return `${selected} Check shared context and respond to pending requests if relevant.`;
  }

  private buildRequestPrompt(request: {
    agentName: string;
    content: Record<string, unknown>;
  }): string {
    const ask = typeof request.content.ask === 'string'
      ? request.content.ask
      : 'Respond to a collaboration request with complementary creative output.';
    return `A collaboration request from ${request.agentName}: ${ask} Check shared context first, then create matching contributions and summarize via shared context tools.`;
  }
}
