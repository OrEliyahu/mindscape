import { create } from 'zustand';
import type { NodePayload, EdgePayload, PresenceUser, AgentStatus } from '@mindscape/shared';

/* ─── Agent activity entry shown in the activity feed ─── */
export interface AgentActivity {
  sessionId: string;
  type: 'status' | 'thought' | 'tool-call' | 'error' | 'collaboration';
  data: unknown;
  timestamp: number;
}

export interface AgentCursor {
  sessionId: string;
  x: number;
  y: number;
  timestamp: number;
}

/* ─── Store shape ────────────────────────────────────── */
interface CanvasState {
  /* canvas data */
  nodes: Map<string, NodePayload>;
  edges: Map<string, EdgePayload>;
  presence: PresenceUser[];
  agentActivity: AgentActivity[];
  agentCursors: Map<string, AgentCursor>;

  /* connection */
  connected: boolean;

  /* viewport (local) */
  viewport: { x: number; y: number; zoom: number };

  /* ─── actions ────────────────────────────────────── */

  /** Replace all nodes + edges (initial state from server) */
  setCanvasState: (nodes: NodePayload[], edges: EdgePayload[]) => void;

  /** Node CRUD received from server */
  addNode: (node: NodePayload) => void;
  patchNode: (id: string, patch: Partial<NodePayload>) => void;
  removeNode: (id: string) => void;

  /** Edge CRUD received from server */
  addEdge: (edge: EdgePayload) => void;
  removeEdge: (id: string) => void;

  /** Presence */
  setPresence: (users: PresenceUser[]) => void;

  /** Agent activity feed */
  pushAgentActivity: (entry: AgentActivity) => void;
  clearAgentActivity: () => void;
  upsertAgentCursor: (cursor: AgentCursor) => void;
  pruneStaleAgentCursors: (maxAgeMs: number) => void;

  /** Connection */
  setConnected: (v: boolean) => void;

  /** Local viewport */
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  nodes: new Map(),
  edges: new Map(),
  presence: [],
  agentActivity: [],
  agentCursors: new Map(),
  connected: false,
  viewport: { x: 0, y: 0, zoom: 1 },

  /* ─── canvas state ───────────────────────────────── */
  setCanvasState: (nodes, edges) =>
    set({
      nodes: new Map(nodes.map((n) => [n.id, n])),
      edges: new Map(edges.map((e) => [e.id, e])),
    }),

  /* ─── nodes ──────────────────────────────────────── */
  addNode: (node) =>
    set((s) => {
      const next = new Map(s.nodes);
      next.set(node.id, node);
      return { nodes: next };
    }),

  patchNode: (id, patch) =>
    set((s) => {
      const existing = s.nodes.get(id);
      if (!existing) return s;
      const next = new Map(s.nodes);
      next.set(id, { ...existing, ...patch });
      return { nodes: next };
    }),

  removeNode: (id) =>
    set((s) => {
      const next = new Map(s.nodes);
      next.delete(id);
      return { nodes: next };
    }),

  /* ─── edges ──────────────────────────────────────── */
  addEdge: (edge) =>
    set((s) => {
      const next = new Map(s.edges);
      next.set(edge.id, edge);
      return { edges: next };
    }),

  removeEdge: (id) =>
    set((s) => {
      const next = new Map(s.edges);
      next.delete(id);
      return { edges: next };
    }),

  /* ─── presence ───────────────────────────────────── */
  setPresence: (users) => set({ presence: users }),

  /* ─── agent activity ─────────────────────────────── */
  pushAgentActivity: (entry) =>
    set((s) => ({
      agentActivity: [...s.agentActivity.slice(-99), entry],
    })),
  clearAgentActivity: () => set({ agentActivity: [] }),
  upsertAgentCursor: (cursor) =>
    set((s) => {
      const next = new Map(s.agentCursors);
      next.set(cursor.sessionId, cursor);
      return { agentCursors: next };
    }),
  pruneStaleAgentCursors: (maxAgeMs) =>
    set((s) => {
      const cutoff = Date.now() - maxAgeMs;
      let pruned = false;
      for (const cursor of s.agentCursors.values()) {
        if (cursor.timestamp < cutoff) {
          pruned = true;
          break;
        }
      }
      if (!pruned) return s;
      const next = new Map(s.agentCursors);
      for (const [sessionId, cursor] of next) {
        if (cursor.timestamp < cutoff) {
          next.delete(sessionId);
        }
      }
      return { agentCursors: next };
    }),

  /* ─── connection ─────────────────────────────────── */
  setConnected: (connected) => set({ connected }),

  /* ─── viewport ───────────────────────────────────── */
  setViewport: (viewport) => set({ viewport }),
}));
