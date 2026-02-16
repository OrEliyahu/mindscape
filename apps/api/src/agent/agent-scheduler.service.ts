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
    'Create a dreamy cluster of unexpected creative motifs (imagery, mood, metaphor) and connect them as echoes.',
    'Expand one existing node into a playful idea constellation with colorful contrast and lyrical labels.',
    'Add an imaginative what-if branch like an artist sketchbook spread, with emotional cross-links.',
  ],
  architect: [
    'Paint a layered visual scene (foreground/midground/background) using descriptive nodes and compositional edges.',
    'Design a mini gallery-wall composition that balances color, scale, and movement across nearby space.',
    'Add a mood-board zone with connected visual anchors that guide the viewer eye smoothly.',
  ],
  coder: [
    'Write a short lyric sequence (verse to chorus) and connect transitions as musical flow.',
    'Add song fragments with hooks, imagery, and refrain links so the cluster feels like a living song sketch.',
    'Compose a rhythm-focused micro-story in lyric form using concise lines and evocative transitions.',
  ],
  analyst: [
    'Create a narrative arc (setup, tension, climax, release) and connect beats with story-relation labels.',
    'Add a character or scene progression branch and tie it into existing themes.',
    'Expand the canvas with a poetic mini-story that flows through mood shifts and visual cues.',
  ],
  'canvas-agent': [
    'Improve the canvas as a living artwork: add expressive nodes, rich color variation, and thematic links.',
    'Extend an existing creative cluster with painterly detail, lyrical phrases, and cohesive emotional flow.',
    'Fill an empty area with a small artistic vignette connected to nearby motifs.',
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
