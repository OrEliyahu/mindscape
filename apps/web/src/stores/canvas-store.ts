import { create } from 'zustand';
import type { NodePayload, EdgePayload, PresenceUser, AgentStatus } from '@mindscape/shared';

/* ─── Agent activity entry shown in the activity feed ─── */
export interface AgentActivity {
  sessionId: string;
  type: 'status' | 'thought' | 'tool-call' | 'error';
  data: unknown;
  timestamp: number;
}

/* ─── Store shape ────────────────────────────────────── */
interface CanvasState {
  /* canvas data */
  nodes: Map<string, NodePayload>;
  edges: Map<string, EdgePayload>;
  presence: PresenceUser[];
  agentActivity: AgentActivity[];

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

  /* ─── connection ─────────────────────────────────── */
  setConnected: (connected) => set({ connected }),

  /* ─── viewport ───────────────────────────────────── */
  setViewport: (viewport) => set({ viewport }),
}));
