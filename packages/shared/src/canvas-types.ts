export type NodeType =
  | 'sticky_note'
  | 'text_block'
  | 'image'
  | 'drawing'
  | 'code_block'
  | 'shape'
  | 'group'
  | 'ai_response';

export interface CanvasNode {
  id: string;
  canvasId: string;
  type: NodeType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  locked: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: string;
  canvasId: string;
  sourceId: string;
  targetId: string;
  label: string | null;
  style: Record<string, unknown>;
  createdAt: string;
}

export interface Canvas {
  id: string;
  ownerId: string | null;
  title: string;
  viewport: Viewport;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CreateNodePayload {
  type: NodeType;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  content?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface NodePayload extends CanvasNode {}

export interface EdgePayload extends Edge {}
