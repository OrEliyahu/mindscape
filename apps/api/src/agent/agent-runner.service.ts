import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodesService } from '../nodes/nodes.service';
import { EdgesService } from '../edges/edges.service';
import { CanvasService } from '../canvas/canvas.service';
import { AgentBroadcastService } from '../collaboration/agent-broadcast.service';
import { AgentSessionRepository } from './agent-session.repository';
import { toolsToOpenRouterFormat } from './agent-tools';
import { toNodePayload, toEdgePayload } from '../common/mappers';
import type { AgentInvokePayload, NodePayload, EdgePayload } from '@mindscape/shared';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

interface LLMToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: LLMToolCall[];
    };
    finish_reason: string;
  }>;
}

const SYSTEM_PROMPT = `You are an AI agent working on a collaborative infinite canvas called Mindscape.
You can create, update, and delete nodes AND edges on the canvas using the provided tools.
Viewers are watching your work in real-time, so build the canvas thoughtfully.

## Node types
- sticky_note: short ideas, reminders, brainstorming items (default ~200×150)
- text_block: longer explanations or documentation (~300×200)
- code_block: code snippets — always set content.language (~350×250)
- ai_response: your own analysis or responses (~300×200)
- shape: visual elements like circles or rectangles (~150×150)

## Layout guidelines
- Space nodes at least 250px apart horizontally or vertically.
- Arrange related nodes in a logical layout: left-to-right for sequences, top-to-bottom for hierarchies.
- When a canvas already has nodes, place new nodes nearby but not overlapping. Check existing positions and find empty space.
- Use the canvas coordinate system: positive X is right, positive Y is down.

## Edges (connections)
- Use create_edge to connect related nodes (e.g. "depends on", "leads to", "contains").
- Always create edges AFTER the nodes they connect exist.
- Add meaningful labels to edges to describe the relationship.

## Workflow
1. Read the canvas context to understand what already exists.
2. Plan your layout — decide positions before creating nodes.
3. Create nodes first, then connect them with edges.
4. Keep content concise and meaningful.`;

const MAX_TOOL_ROUNDS = 10;

/**
 * Executes an AI agent on a canvas.
 *
 * Flow: receive prompt → call LLM → execute tool calls → broadcast to viewers → repeat until done.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly nodesService: NodesService,
    private readonly edgesService: EdgesService,
    private readonly canvasService: CanvasService,
    private readonly broadcast: AgentBroadcastService,
    private readonly sessions: AgentSessionRepository,
  ) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
    this.apiUrl = this.configService.get<string>(
      'OPENROUTER_API_URL',
      'https://openrouter.ai/api/v1/chat/completions',
    );
  }

  /**
   * Invoke an agent on a canvas. Runs in the background (fire-and-forget).
   * Progress is streamed to viewers via AgentBroadcastService.
   */
  async invoke(canvasId: string, payload: AgentInvokePayload): Promise<{ sessionId: string }> {
    const model = payload.model || 'google/gemini-2.0-flash-001';

    // 1. Create session
    const session = await this.sessions.create(canvasId, 'canvas-agent', model);
    this.broadcast.broadcastAgentStatus(canvasId, session.id, 'thinking');
    this.logger.log(`Agent session ${session.id} started on canvas ${canvasId}`);

    // 2. Run agent loop in background (don't await)
    this.runAgentLoop(canvasId, session.id, model, payload).catch((err) => {
      this.logger.error(`Agent session ${session.id} failed: ${err.message}`);
      this.sessions.updateStatus(session.id, 'error');
      this.broadcast.broadcastAgentError(canvasId, session.id, err.message);
    });

    return { sessionId: session.id };
  }

  private async runAgentLoop(
    canvasId: string,
    sessionId: string,
    model: string,
    payload: AgentInvokePayload,
  ) {
    // Build initial context with existing canvas state (already camelCase from service)
    const canvas = await this.canvasService.findOneWithNodes(canvasId);
    const existingNodes = (canvas.nodes as NodePayload[]).map((n) => ({
      id: n.id,
      type: n.type,
      positionX: n.positionX,
      positionY: n.positionY,
      width: n.width,
      height: n.height,
      content: n.content,
    }));
    const existingEdges = (canvas.edges as EdgePayload[]).map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      targetId: e.targetId,
      label: e.label,
    }));

    // Compute bounding box so the agent knows where free space is
    let spatialHint = 'The canvas is empty — start placing nodes near (0, 0).';
    if (existingNodes.length > 0) {
      const maxX = Math.max(...existingNodes.map((n) => n.positionX + (n.width ?? 200)));
      const maxY = Math.max(...existingNodes.map((n) => n.positionY + (n.height ?? 200)));
      const minX = Math.min(...existingNodes.map((n) => n.positionX));
      const minY = Math.min(...existingNodes.map((n) => n.positionY));
      spatialHint = `Occupied area: x ${minX}–${maxX}, y ${minY}–${maxY}. Place new nodes outside this area or find gaps.`;
    }

    const canvasContext = [
      `Canvas: "${canvas.title}" (${canvasId})`,
      spatialHint,
      `Nodes (${existingNodes.length}):`,
      JSON.stringify(existingNodes, null, 2),
      `Edges (${existingEdges.length}):`,
      existingEdges.length > 0 ? JSON.stringify(existingEdges, null, 2) : '(none)',
      '',
      `User request: ${payload.prompt}`,
    ].join('\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: canvasContext },
    ];

    const tools = toolsToOpenRouterFormat();

    // Agent loop: call LLM → execute tools → repeat
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      this.broadcast.broadcastAgentStatus(canvasId, sessionId, 'thinking');

      const response = await this.callLLM(model, messages, tools);
      const choice = response.choices[0];

      if (!choice) {
        this.logger.warn(`No choice returned from LLM in round ${round}`);
        break;
      }

      const assistantMsg = choice.message;

      // If the LLM returned a text thought, broadcast it
      if (assistantMsg.content) {
        this.broadcast.broadcastAgentThought(canvasId, sessionId, assistantMsg.content);
      }

      // No tool calls → agent is done
      if (!assistantMsg.tool_calls?.length) {
        messages.push({ role: 'assistant', content: assistantMsg.content });
        break;
      }

      // Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: assistantMsg.content,
        tool_calls: assistantMsg.tool_calls,
      });

      // Execute each tool call
      this.broadcast.broadcastAgentStatus(canvasId, sessionId, 'acting');

      for (const toolCall of assistantMsg.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function;
        let args: Record<string, unknown>;

        try {
          args = JSON.parse(argsStr);
        } catch {
          const errorMsg = `Invalid JSON arguments for tool ${name}`;
          messages.push({ role: 'tool', content: errorMsg, tool_call_id: toolCall.id });
          continue;
        }

        const result = await this.executeTool(canvasId, sessionId, name, args);

        // Record tool call in DB
        await this.sessions.appendToolCall(sessionId, { tool: name, args, result });

        // Broadcast tool call to viewers
        this.broadcast.broadcastAgentToolCall(canvasId, sessionId, name, args, result);

        // Append tool result for next LLM round
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }
    }

    // Done
    await this.sessions.updateStatus(sessionId, 'idle');
    this.broadcast.broadcastAgentStatus(canvasId, sessionId, 'idle');
    this.logger.log(`Agent session ${sessionId} completed`);
  }

  private async executeTool(
    canvasId: string,
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      switch (toolName) {
        case 'create_node': {
          const node = await this.nodesService.create(canvasId, {
            type: (args.type as string) ?? 'sticky_note',
            positionX: args.positionX as number | undefined,
            positionY: args.positionY as number | undefined,
            width: args.width as number | undefined,
            height: args.height as number | undefined,
            content: args.content as Record<string, unknown> | undefined,
            style: args.style as Record<string, unknown> | undefined,
            createdBy: undefined, // agents aren't users — skip FK
          });
          this.broadcast.broadcastNodeCreated(canvasId, toNodePayload(node));
          return { success: true, nodeId: node.id };
        }

        case 'update_node': {
          const id = args.id as string;
          const patch = { ...args };
          delete patch.id;
          const updated = await this.nodesService.update(id, patch);
          this.broadcast.broadcastNodeUpdated(canvasId, id, patch as Partial<NodePayload>);
          return { success: true, nodeId: updated.id };
        }

        case 'delete_node': {
          const id = args.id as string;
          await this.nodesService.remove(id);
          this.broadcast.broadcastNodeDeleted(canvasId, id);
          return { success: true, deleted: id };
        }

        case 'create_edge': {
          const edge = await this.edgesService.create(canvasId, {
            sourceId: args.sourceId as string,
            targetId: args.targetId as string,
            label: args.label as string | undefined,
            style: args.style as Record<string, unknown> | undefined,
          });
          this.broadcast.broadcastEdgeCreated(canvasId, toEdgePayload(edge));
          return { success: true, edgeId: edge.id };
        }

        case 'delete_edge': {
          const id = args.id as string;
          await this.edgesService.remove(id);
          this.broadcast.broadcastEdgeDeleted(canvasId, id);
          return { success: true, deleted: id };
        }

        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${toolName} failed: ${message}`);
      return { error: message };
    }
  }

  private async callLLM(
    model: string,
    messages: LLMMessage[],
    tools: ReturnType<typeof toolsToOpenRouterFormat>,
  ): Promise<LLMResponse> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<LLMResponse>;
  }

}
