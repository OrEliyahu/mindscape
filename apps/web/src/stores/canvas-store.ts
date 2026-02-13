import { create } from 'zustand';
import type { CanvasNode, Edge, Viewport } from '@mindscape/shared';

interface CanvasState {
  nodes: Map<string, CanvasNode>;
  edges: Map<string, Edge>;
  selectedIds: Set<string>;
  viewport: Viewport;
}

interface CanvasActions {
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelection: (ids: string[]) => void;
  updateViewport: (viewport: Partial<Viewport>) => void;
}

export type CanvasStore = CanvasState & CanvasActions;

export const useCanvasStore = create<CanvasStore>()((set) => ({
  nodes: new Map(),
  edges: new Map(),
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, zoom: 1 },

  addNode: (node) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(node.id, node);
      return { nodes };
    }),

  updateNode: (id, patch) =>
    set((state) => {
      const existing = state.nodes.get(id);
      if (!existing) return state;
      const nodes = new Map(state.nodes);
      nodes.set(id, { ...existing, ...patch });
      return { nodes };
    }),

  removeNode: (id) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.delete(id);
      const selectedIds = new Set(state.selectedIds);
      selectedIds.delete(id);
      return { nodes, selectedIds };
    }),

  addEdge: (edge) =>
    set((state) => {
      const edges = new Map(state.edges);
      edges.set(edge.id, edge);
      return { edges };
    }),

  removeEdge: (id) =>
    set((state) => {
      const edges = new Map(state.edges);
      edges.delete(id);
      return { edges };
    }),

  setNodes: (nodes) =>
    set(() => ({
      nodes: new Map(nodes.map((n) => [n.id, n])),
    })),

  setEdges: (edges) =>
    set(() => ({
      edges: new Map(edges.map((e) => [e.id, e])),
    })),

  setSelection: (ids) =>
    set(() => ({
      selectedIds: new Set(ids),
    })),

  updateViewport: (patch) =>
    set((state) => ({
      viewport: { ...state.viewport, ...patch },
    })),
}));
