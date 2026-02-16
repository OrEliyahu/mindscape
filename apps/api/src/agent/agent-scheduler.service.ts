import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { CanvasService } from '../canvas/canvas.service';
import { AgentRunnerService } from './agent-runner.service';
import { listPersonas } from './agent-registry';

const CHECK_INTERVAL_MS = 5000;
const DEFAULT_ACTION_INTERVAL_MS = 45000;

const PERSONA_PROMPT_TEMPLATES: Record<string, string[]> = {
  brainstormer: [
    'Add a burst of surprising idea clusters around one existing concept and connect them with labeled links.',
    'Create a playful branch of alternatives that challenge assumptions and relate it to prior nodes.',
    'Introduce fresh what-if ideas in a radial layout with concise sticky notes and clear relationship edges.',
  ],
  architect: [
    'Expand the canvas with a layered architecture section and map dependencies between components.',
    'Add a structured subsystem diagram with boundaries, interfaces, and directional data-flow edges.',
    'Organize a hub-and-spoke technical layout that extends existing structures without overlaps.',
  ],
  coder: [
    'Contribute implementation-focused code and explanation nodes, then connect logic and data flow.',
    'Add code-first nodes for one feature path, include concise notes, and wire references with labeled edges.',
    'Build a mini coding sequence from setup to result, balancing code snippets and explanatory text.',
  ],
  analyst: [
    'Add a compact analysis chain from observation to inference to recommendation with explicit connections.',
    'Create a comparison section with tradeoffs and tie it into existing decision nodes.',
    'Expand the map with cause-effect analysis nodes and connect supporting evidence paths.',
  ],
  'canvas-agent': [
    'Improve the overall canvas composition by adding meaningful nodes and edges where structure is weak.',
    'Extend an existing topic cluster with complementary details and cohesive linking edges.',
    'Fill empty space with a thoughtfully connected sub-map that builds on current content.',
  ],
};

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
    const persona = personas[Math.floor(Math.random() * personas.length)];
    const prompt = this.pickPrompt(persona.key);

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

  private pickPrompt(personaKey: string): string {
    const prompts = PERSONA_PROMPT_TEMPLATES[personaKey] ?? PERSONA_PROMPT_TEMPLATES['canvas-agent'];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
}
