import { CANVAS_TOOLS, toolsToOpenRouterFormat } from './agent-tools';

describe('agent-tools', () => {
  describe('CANVAS_TOOLS', () => {
    it('defines all expected tools', () => {
      const names = CANVAS_TOOLS.map((t) => t.name);
      expect(names).toContain('create_node');
      expect(names).toContain('update_node');
      expect(names).toContain('delete_node');
      expect(names).toContain('create_edge');
      expect(names).toContain('delete_edge');
    });

    it('every tool has name, description, and parameters', () => {
      for (const tool of CANVAS_TOOLS) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
      }
    });

    it('create_node requires type parameter', () => {
      const tool = CANVAS_TOOLS.find((t) => t.name === 'create_node')!;
      expect((tool.parameters as { required: string[] }).required).toContain('type');
    });

    it('create_edge requires sourceId and targetId', () => {
      const tool = CANVAS_TOOLS.find((t) => t.name === 'create_edge')!;
      const required = (tool.parameters as { required: string[] }).required;
      expect(required).toContain('sourceId');
      expect(required).toContain('targetId');
    });
  });

  describe('toolsToOpenRouterFormat', () => {
    it('wraps each tool in OpenRouter function format', () => {
      const formatted = toolsToOpenRouterFormat();
      expect(formatted.length).toBe(CANVAS_TOOLS.length);

      for (const tool of formatted) {
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
      }
    });
  });
});
