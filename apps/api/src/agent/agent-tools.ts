/**
 * Tool definitions the LLM can call to manipulate the canvas.
 *
 * Each tool maps to a NodesService / CanvasService method.
 * The agent runner parses the LLM response and dispatches to
 * the appropriate service + broadcasts the result to viewers.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const CANVAS_TOOLS: ToolDefinition[] = [
  {
    name: 'create_node',
    description:
      'Create a new node on the canvas. Use this to add sticky notes, text blocks, code blocks, AI responses, or shapes.',
    parameters: {
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['sticky_note', 'text_block', 'code_block', 'ai_response', 'shape'],
          description: 'The type of node to create',
        },
        positionX: { type: 'number', description: 'X position on the canvas (default: 0)' },
        positionY: { type: 'number', description: 'Y position on the canvas (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 200)' },
        height: { type: 'number', description: 'Height in pixels (default: 200)' },
        content: {
          type: 'object',
          description: 'Node content. Use { "text": "..." } for most node types.',
          properties: {
            text: { type: 'string', description: 'The text content of the node' },
            title: { type: 'string', description: 'An optional title' },
            language: { type: 'string', description: 'Programming language (for code_block)' },
          },
        },
        style: {
          type: 'object',
          description: 'Visual style overrides',
          properties: {
            backgroundColor: { type: 'string' },
            borderColor: { type: 'string' },
            fontSize: { type: 'number' },
          },
        },
      },
    },
  },
  {
    name: 'update_node',
    description: 'Update an existing node on the canvas (change its content, position, size, or style).',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'The UUID of the node to update' },
        positionX: { type: 'number' },
        positionY: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        content: { type: 'object' },
        style: { type: 'object' },
      },
    },
  },
  {
    name: 'delete_node',
    description: 'Remove a node from the canvas.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'The UUID of the node to delete' },
      },
    },
  },
  {
    name: 'create_edge',
    description:
      'Create a directed edge (connection) between two nodes. Use this to show relationships, flow, or dependencies between ideas.',
    parameters: {
      type: 'object',
      required: ['sourceId', 'targetId'],
      properties: {
        sourceId: { type: 'string', description: 'UUID of the source node' },
        targetId: { type: 'string', description: 'UUID of the target node' },
        label: { type: 'string', description: 'Optional label for the edge (e.g. "leads to", "depends on")' },
        style: {
          type: 'object',
          description: 'Visual style overrides for the edge',
          properties: {
            color: { type: 'string' },
            strokeWidth: { type: 'number' },
            dashed: { type: 'boolean' },
          },
        },
      },
    },
  },
  {
    name: 'delete_edge',
    description: 'Remove an edge (connection) from the canvas.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'The UUID of the edge to delete' },
      },
    },
  },
];

/**
 * Convert our tool definitions into the OpenRouter / OpenAI
 * function-calling format.
 */
export function toolsToOpenRouterFormat() {
  return CANVAS_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
