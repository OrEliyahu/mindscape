import {
  buildSystemPrompt,
  getPersona,
  listPersonas,
  AGENT_PERSONAS,
  DEFAULT_PERSONA_KEY,
} from './agent-registry';

describe('agent-registry', () => {
  describe('listPersonas', () => {
    it('returns all registered personas', () => {
      const personas = listPersonas();
      expect(personas.length).toBeGreaterThanOrEqual(5);
      const keys = personas.map((p) => p.key);
      expect(keys).toContain('brainstormer');
      expect(keys).toContain('architect');
      expect(keys).toContain('coder');
      expect(keys).toContain('analyst');
      expect(keys).toContain('canvas-agent');
    });

    it('every persona has required properties', () => {
      for (const persona of listPersonas()) {
        expect(persona.key).toBeTruthy();
        expect(persona.name).toBeTruthy();
        expect(persona.emoji).toBeTruthy();
        expect(persona.color).toMatch(/^#/);
        expect(persona.description).toBeTruthy();
        expect(typeof persona.systemPromptSuffix).toBe('string');
      }
    });
  });

  describe('getPersona', () => {
    it('returns the correct persona by key', () => {
      const brainstormer = getPersona('brainstormer');
      expect(brainstormer.key).toBe('brainstormer');
      expect(brainstormer.name).toBe('Brainstormer');
    });

    it('falls back to default persona for unknown key', () => {
      const fallback = getPersona('unknown-persona');
      expect(fallback.key).toBe(DEFAULT_PERSONA_KEY);
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes base instructions for all personas', () => {
      const prompt = buildSystemPrompt('brainstormer');
      expect(prompt).toContain('Mindscape');
      expect(prompt).toContain('Node types');
      expect(prompt).toContain('Layout guidelines');
    });

    it('includes persona-specific suffix for brainstormer', () => {
      const prompt = buildSystemPrompt('brainstormer');
      expect(prompt).toContain('Brainstormer');
      expect(prompt).toContain('creative ideation');
    });

    it('includes persona-specific suffix for coder', () => {
      const prompt = buildSystemPrompt('coder');
      expect(prompt).toContain('Coder');
      expect(prompt).toContain('code_blocks');
    });

    it('default persona has no extra suffix', () => {
      const defaultPrompt = buildSystemPrompt('canvas-agent');
      // Default persona suffix is empty string
      expect(defaultPrompt).not.toContain('Your persona');
    });

    it('unknown persona key uses default prompt', () => {
      const prompt = buildSystemPrompt('nonexistent');
      const defaultPrompt = buildSystemPrompt(DEFAULT_PERSONA_KEY);
      expect(prompt).toBe(defaultPrompt);
    });
  });
});
