import type { NodePayload, EdgePayload } from './canvas-types';
import type { AgentStatus, PresenceUser } from './agent-types';

/**
 * Events the CLIENT can send to the server.
 *
 * Clients are **viewers only** – they join/leave a canvas and receive
 * real-time updates pushed by backend agents. They never create, update
 * or delete nodes themselves.
 */
export interface ClientToServerEvents {
  /** Join a canvas room to start receiving updates */
  'join-canvas': (data: { canvasId: string }) => void;
  /** Leave the canvas room */
  'leave-canvas': (data: { canvasId: string }) => void;
  /** Request a specific viewport slice (optional optimisation) */
  'viewport:update': (data: { x: number; y: number; w: number; h: number; zoom: number }) => void;
}

/**
 * Events the SERVER pushes to connected clients.
 *
 * All canvas mutations originate from backend agents; the gateway
 * broadcasts the result to every client in the room.
 */
export interface ServerToClientEvents {
  /* ── Canvas state ─────────────────────────────── */
  'canvas:state': (data: { nodes: NodePayload[]; edges: EdgePayload[] }) => void;

  /* ── Node CRUD (pushed by agents via AgentBroadcastService) ── */
  'node:created': (data: { node: NodePayload }) => void;
  'node:updated': (data: { id: string; patch: Partial<NodePayload> }) => void;
  'node:deleted': (data: { id: string }) => void;

  /* ── Edge CRUD ───────────────────────────────── */
  'edge:created': (data: { edge: EdgePayload }) => void;
  'edge:deleted': (data: { id: string }) => void;

  /* ── Presence ─────────────────────────────────── */
  'presence:update': (data: { users: PresenceUser[] }) => void;

  /* ── Agent activity feed ─────────────────────── */
  'agent:status': (data: { sessionId: string; status: AgentStatus }) => void;
  'agent:thought': (data: { sessionId: string; text: string }) => void;
  'agent:tool-call': (data: { sessionId: string; tool: string; args: unknown; result: unknown }) => void;
  'agent:cursor': (data: { sessionId: string; x: number; y: number }) => void;
  'agent:error': (data: { sessionId: string; error: string }) => void;
}
