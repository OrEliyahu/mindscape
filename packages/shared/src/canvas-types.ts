export type NodeType =
  | 'sticky_note'
  | 'text_block'
  | 'image'
  | 'drawing'
  | 'code_block'
  | 'shape'
  | 'group'
  | 'ai_response'
  | 'path'
  | 'svg'
  | 'gradient_shape'
  | 'text_art';

export interface NodeShadowStyle {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface NodeGradientStyle {
  type?: 'linear' | 'radial';
  colorStops?: Record<string, string>;
  angle?: number;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  opacity?: number;
  shadow?: NodeShadowStyle;
  gradient?: NodeGradientStyle;
  path?: string;
  fillPattern?: string;
  blendMode?: string;
  color?: string;
  dashed?: boolean;
}

export interface NodeContent extends Record<string, unknown> {
  text?: string;
  title?: string;
  language?: string;
  pathData?: string;
  svg?: string;
}

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
  content: NodeContent;
  style: NodeStyle;
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
  style: NodeStyle;
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
  content?: NodeContent;
  style?: NodeStyle;
}

export interface NodePayload extends CanvasNode {}

export interface EdgePayload extends Edge {}
