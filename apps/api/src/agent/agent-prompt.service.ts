import { Injectable } from '@nestjs/common';
import { AGENT_PERSONAS, BASE_INSTRUCTIONS, DEFAULT_PERSONA_KEY, getPersona } from './agent-registry';
import { DEFAULT_SCHEDULER_PROMPT_TEMPLATES } from './agent-prompt-defaults';
import { AgentPromptRepository, type AgentPromptConfigRecord } from './agent-prompt.repository';

const BASE_KEY = '__base__';

@Injectable()
export class AgentPromptService {
  constructor(private readonly repo: AgentPromptRepository) {}

  async buildSystemPrompt(personaKey: string): Promise<string> {
    const resolvedKey = getPersona(personaKey).key;
    const snapshot = await this.getSnapshot();
    const suffix = snapshot.suffixByPersona.get(resolvedKey)
      ?? AGENT_PERSONAS[resolvedKey]?.systemPromptSuffix
      ?? AGENT_PERSONAS[DEFAULT_PERSONA_KEY].systemPromptSuffix;
    return snapshot.baseInstructions + suffix;
  }

  async getSchedulerPrompts(personaKey: string): Promise<string[]> {
    const resolvedKey = getPersona(personaKey).key;
    const snapshot = await this.getSnapshot();
    return snapshot.schedulerByPersona.get(resolvedKey)
      ?? DEFAULT_SCHEDULER_PROMPT_TEMPLATES[resolvedKey]
      ?? DEFAULT_SCHEDULER_PROMPT_TEMPLATES[DEFAULT_PERSONA_KEY];
  }

  async getAdminView() {
    const rows = await this.repo.findAll();
    const byKey = new Map(rows.map((row) => [row.personaKey, row]));
    const baseOverride = byKey.get(BASE_KEY);
    const baseInstructions = baseOverride?.baseInstructions ?? BASE_INSTRUCTIONS;

    const personas = Object.values(AGENT_PERSONAS).map((persona) => {
      const override = byKey.get(persona.key);
      return {
        key: persona.key,
        name: persona.name,
        emoji: persona.emoji,
        color: persona.color,
        description: persona.description,
        systemPromptSuffix: override?.systemPromptSuffix ?? persona.systemPromptSuffix,
        schedulerPrompts: override?.schedulerPrompts ?? DEFAULT_SCHEDULER_PROMPT_TEMPLATES[persona.key] ?? [],
        overridden: Boolean(override),
        updatedAt: override?.updatedAt ?? null,
        updatedBy: override?.updatedBy ?? null,
      };
    });

    return {
      baseInstructions,
      baseUpdatedAt: baseOverride?.updatedAt ?? null,
      baseUpdatedBy: baseOverride?.updatedBy ?? null,
      personas,
    };
  }

  async updateBaseInstructions(baseInstructions: string, updatedBy?: string) {
    return this.repo.upsert({
      personaKey: BASE_KEY,
      baseInstructions,
      updatedBy: updatedBy ?? null,
    });
  }

  async updatePersonaPrompt(
    personaKey: string,
    input: { systemPromptSuffix?: string; schedulerPrompts?: string[] },
    updatedBy?: string,
  ) {
    const resolved = getPersona(personaKey).key;
    return this.repo.upsert({
      personaKey: resolved,
      systemPromptSuffix: input.systemPromptSuffix ?? null,
      schedulerPrompts: input.schedulerPrompts ?? null,
      updatedBy: updatedBy ?? null,
    });
  }

  async resetBaseInstructions() {
    await this.repo.remove(BASE_KEY);
  }

  async resetPersonaPrompt(personaKey: string) {
    const resolved = getPersona(personaKey).key;
    await this.repo.remove(resolved);
  }

  private async getSnapshot() {
    const rows = await this.repo.findAll();
    return {
      baseInstructions: rows.find((row) => row.personaKey === BASE_KEY)?.baseInstructions ?? BASE_INSTRUCTIONS,
      suffixByPersona: new Map(
        rows
          .filter((row) => row.personaKey !== BASE_KEY && typeof row.systemPromptSuffix === 'string')
          .map((row) => [row.personaKey, row.systemPromptSuffix as string]),
      ),
      schedulerByPersona: new Map(
        rows
          .filter(
            (row): row is AgentPromptConfigRecord & { schedulerPrompts: string[] } =>
              row.personaKey !== BASE_KEY && Array.isArray(row.schedulerPrompts),
          )
          .map((row) => [row.personaKey, row.schedulerPrompts]),
      ),
    };
  }
}
