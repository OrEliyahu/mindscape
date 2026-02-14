export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'error';

export interface AgentSession {
  id: string;
  canvasId: string;
  agentName: string;
  model: string;
  status: AgentStatus;
  context: Record<string, unknown>;
  toolCalls: AgentToolCall[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: string;
}

export interface AgentInvokePayload {
  prompt: string;
  model: string;
  agentType?: string;
  context?: {
    selectedNodeIds?: string[];
    viewport?: { x: number; y: number; width: number; height: number; zoom: number };
  };
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  isAgent: boolean;
}
