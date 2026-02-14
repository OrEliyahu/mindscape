import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodesService } from '../nodes/nodes.service';
import { CanvasService } from '../canvas/canvas.service';
import { AgentBroadcastService } from '../collaboration/agent-broadcast.service';
import { AgentSessionRepository } from './agent-session.repository';
import { toolsToOpenRouterFormat } from './agent-tools';
import type { AgentInvokePayload, NodePayload } from '@mindscape/shared';

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
You can create, update, and delete nodes on the canvas using the provided tools.

When creating nodes, space them out nicely (at least 250px apart) and use appropriate types:
- sticky_note: for short ideas, reminders, brainstorming items
- text_block: for longer explanations or documentation
- code_block: for code snippets (set content.language)
- ai_response: for your own analysis or responses
- shape: for visual elements

Always provide meaningful text content. Be creative and helpful.
Think step-by-step: first understand the user's request, then plan what nodes to create, then execute.`;

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
    // Build initial context with existing canvas nodes
    const canvas = await this.canvasService.findOneWithNodes(canvasId);
    const existingNodes = (canvas.nodes as Record<string, unknown>[]).map((n) => ({
      id: n.id,
      type: n.type,
      positionX: n.position_x,
      positionY: n.position_y,
      width: n.width,
      height: n.height,
      content: n.content,
    }));

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Canvas currently has ${existingNodes.length} nodes:\n${JSON.stringify(existingNodes, null, 2)}\n\nUser request: ${payload.prompt}`,
      },
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
          this.broadcast.broadcastNodeCreated(canvasId, this.toNodePayload(node));
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

  /** Map raw DB row (snake_case) to NodePayload (camelCase) */
  private toNodePayload(row: Record<string, unknown>): NodePayload {
    return {
      id: row.id as string,
      canvasId: row.canvas_id as string,
      type: row.type as NodePayload['type'],
      positionX: row.position_x as number,
      positionY: row.position_y as number,
      width: row.width as number,
      height: row.height as number,
      rotation: (row.rotation as number) ?? 0,
      zIndex: row.z_index as number,
      content: row.content as Record<string, unknown>,
      style: row.style as Record<string, unknown>,
      locked: (row.locked as boolean) ?? false,
      createdBy: (row.created_by as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
