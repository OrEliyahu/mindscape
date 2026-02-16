import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodesService } from '../nodes/nodes.service';
import { EdgesService } from '../edges/edges.service';
import { CanvasService } from '../canvas/canvas.service';
import { AgentBroadcastService } from '../collaboration/agent-broadcast.service';
import { AgentSessionRepository } from './agent-session.repository';
import { toolsToOpenRouterFormat } from './agent-tools';
import { buildSystemPrompt, getPersona, DEFAULT_PERSONA_KEY } from './agent-registry';
import { toNodePayload, toEdgePayload } from '../common/mappers';
import { sanitizeAgentPrompt } from '../common/utils/sanitize-agent-prompt';
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

const MAX_TOOL_ROUNDS = 10;
const MAX_CONCURRENT_SESSIONS_PER_CANVAS = 3;
const TOOL_RATE_LIMIT_MS = 500; // minimum ms between tool executions

/**
 * Executes an AI agent on a canvas.
 *
 * Flow: receive prompt → call LLM → execute tool calls → broadcast to viewers → repeat until done.
 * Supports multiple agent personas and concurrent sessions per canvas.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  /** Track active sessions per canvas for concurrency limiting. */
  private readonly activeSessions = new Map<string, Set<string>>();

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
  async invoke(canvasId: string, payload: AgentInvokePayload): Promise<{ sessionId: string; agentType: string }> {
    const sanitizedPrompt = sanitizeAgentPrompt(payload.prompt);
    if (!sanitizedPrompt) {
      throw new BadRequestException('Prompt cannot be empty');
    }

    const normalizedPayload: AgentInvokePayload = {
      ...payload,
      prompt: sanitizedPrompt,
    };

    const model = normalizedPayload.model || 'google/gemini-2.0-flash-001';
    const agentType = normalizedPayload.agentType || DEFAULT_PERSONA_KEY;
    const persona = getPersona(agentType);

    // Check concurrent session limit
    const active = this.activeSessions.get(canvasId);
    if (active && active.size >= MAX_CONCURRENT_SESSIONS_PER_CANVAS) {
      throw new Error(
        `Canvas already has ${active.size} active agent sessions (max ${MAX_CONCURRENT_SESSIONS_PER_CANVAS}). Wait for one to finish.`,
      );
    }

    // Capture current canvas state before every agent run for undo/history.
    try {
      await this.canvasService.createSnapshot(canvasId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to create pre-run snapshot for canvas ${canvasId}: ${message}`);
    }

    // Create session with persona name
    const session = await this.sessions.create(canvasId, persona.key, model);

    // Track active session
    if (!this.activeSessions.has(canvasId)) {
      this.activeSessions.set(canvasId, new Set());
    }
    this.activeSessions.get(canvasId)!.add(session.id);

    this.broadcast.broadcastAgentStatus(canvasId, session.id, 'thinking');
    this.logger.log(`Agent session ${session.id} (${persona.name}) started on canvas ${canvasId}`);

    // Run agent loop in background (don't await)
    this.runAgentLoop(canvasId, session.id, model, agentType, normalizedPayload)
      .catch((err) => {
        this.logger.error(`Agent session ${session.id} failed: ${err.message}`);
        this.sessions.updateStatus(session.id, 'error');
        this.broadcast.broadcastAgentError(canvasId, session.id, err.message);
      })
      .finally(() => {
        // Clean up active session tracking
        const set = this.activeSessions.get(canvasId);
        if (set) {
          set.delete(session.id);
          if (set.size === 0) this.activeSessions.delete(canvasId);
        }
      });

    return { sessionId: session.id, agentType: persona.key };
  }

  /** Get count of active sessions on a canvas. */
  getActiveSessionCount(canvasId: string): number {
    return this.activeSessions.get(canvasId)?.size ?? 0;
  }

  private async runAgentLoop(
    canvasId: string,
    sessionId: string,
    model: string,
    agentType: string,
    payload: AgentInvokePayload,
  ) {
    const persona = getPersona(agentType);

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
    const nodeSummaries = existingNodes.slice(0, 24).map((node) => ({
      id: node.id,
      type: node.type,
      summary: this.extractNodeSummary(node.content),
    }));
    const edgeToNodeRatio = existingNodes.length > 0
      ? (existingEdges.length / existingNodes.length).toFixed(2)
      : '0.00';

    // Compute bounding box so the agent knows where free space is
    let spatialHint = 'The canvas is empty — start placing nodes near (0, 0).';
    if (existingNodes.length > 0) {
      const maxX = Math.max(...existingNodes.map((n) => n.positionX + (n.width ?? 200)));
      const maxY = Math.max(...existingNodes.map((n) => n.positionY + (n.height ?? 200)));
      const minX = Math.min(...existingNodes.map((n) => n.positionX));
      const minY = Math.min(...existingNodes.map((n) => n.positionY));
      spatialHint = `Occupied area: x ${minX}–${maxX}, y ${minY}–${maxY}. Place new nodes outside this area or find gaps.`;
    }

    // Note other active agents on this canvas
    const otherActiveCount = (this.activeSessions.get(canvasId)?.size ?? 1) - 1;
    const multiAgentHint = otherActiveCount > 0
      ? `\nNote: ${otherActiveCount} other agent(s) are also working on this canvas right now. Avoid placing nodes where they might be working.`
      : '';

    const canvasContext = [
      `Canvas: "${canvas.title}" (${canvasId})`,
      `You are: ${persona.emoji} ${persona.name}`,
      spatialHint + multiAgentHint,
      `Current edge-to-node ratio: ${edgeToNodeRatio}. If low, prioritize creating more relationships.`,
      `Node summaries (${nodeSummaries.length}):`,
      nodeSummaries.length > 0 ? JSON.stringify(nodeSummaries, null, 2) : '(none)',
      `Nodes (${existingNodes.length}):`,
      JSON.stringify(existingNodes, null, 2),
      `Edges (${existingEdges.length}):`,
      existingEdges.length > 0 ? JSON.stringify(existingEdges, null, 2) : '(none)',
      '',
      `User request: ${payload.prompt}`,
    ].join('\n');

    const systemPrompt = buildSystemPrompt(agentType);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: canvasContext },
    ];

    const tools = toolsToOpenRouterFormat();
    let lastToolTime = 0;

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

        // Rate limiting: wait if executing tools too fast
        const now = Date.now();
        const elapsed = now - lastToolTime;
        if (elapsed < TOOL_RATE_LIMIT_MS) {
          await this.sleep(TOOL_RATE_LIMIT_MS - elapsed);
        }

        const result = await this.executeTool(canvasId, sessionId, name, args);
        lastToolTime = Date.now();

        // Record tool call in DB
        await this.sessions.appendToolCall(sessionId, { tool: name, args, result });

        // Broadcast tool call to viewers
        this.broadcast.broadcastAgentToolCall(canvasId, sessionId, name, args, result);

        // Broadcast cursor position when creating/updating nodes
        if ((name === 'create_node' || name === 'update_node') && args.positionX != null && args.positionY != null) {
          this.broadcast.broadcastAgentCursor(
            canvasId,
            sessionId,
            args.positionX as number,
            args.positionY as number,
          );
        }

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
    this.logger.log(`Agent session ${sessionId} (${persona.name}) completed`);
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

  private extractNodeSummary(content: Record<string, unknown>): string {
    const text = typeof content.text === 'string' ? content.text : '';
    const title = typeof content.title === 'string' ? content.title : '';
    const code = typeof content.code === 'string' ? content.code : '';
    const raw = [title, text, code].find((value) => value.trim().length > 0) ?? '';
    if (!raw) return '(no textual content)';
    const singleLine = raw.replace(/\s+/g, ' ').trim();
    return singleLine.length > 120 ? `${singleLine.slice(0, 120)}...` : singleLine;
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
