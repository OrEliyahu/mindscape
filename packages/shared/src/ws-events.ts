import type { CreateNodePayload, NodePayload, EdgePayload, Viewport } from './canvas-types';
import type { AgentStatus, PresenceUser } from './agent-types';

export interface ClientToServerEvents {
  'join-canvas': (data: { canvasId: string }) => void;
  'leave-canvas': (data: { canvasId: string }) => void;
  'node:create': (data: { node: CreateNodePayload }) => void;
  'node:update': (data: { id: string; patch: Partial<NodePayload> }) => void;
  'node:delete': (data: { id: string }) => void;
  'cursor:move': (data: { x: number; y: number }) => void;
  'selection:change': (data: { nodeIds: string[] }) => void;
  'yjs:sync': (data: { update: ArrayBuffer }) => void;
  'agent:invoke': (data: { prompt: string; model: string }) => void;
  'agent:stop': (data: { sessionId: string }) => void;
}

export interface ServerToClientEvents {
  'canvas:state': (data: { nodes: NodePayload[]; edges: EdgePayload[] }) => void;
  'node:created': (data: { node: NodePayload }) => void;
  'node:updated': (data: { id: string; patch: Partial<NodePayload> }) => void;
  'node:deleted': (data: { id: string }) => void;
  'cursor:moved': (data: { userId: string; x: number; y: number; name: string; color: string }) => void;
  'selection:changed': (data: { userId: string; nodeIds: string[] }) => void;
  'presence:update': (data: { users: PresenceUser[] }) => void;
  'yjs:sync': (data: { update: ArrayBuffer }) => void;
  'agent:status': (data: { sessionId: string; status: AgentStatus }) => void;
  'agent:thought': (data: { sessionId: string; text: string }) => void;
  'agent:tool-call': (data: { sessionId: string; tool: string; args: unknown; result: unknown }) => void;
  'agent:cursor': (data: { sessionId: string; x: number; y: number }) => void;
  'agent:error': (data: { sessionId: string; error: string }) => void;
}
