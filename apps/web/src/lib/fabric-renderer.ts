import {
  Canvas,
  Circle,
  Gradient,
  Group,
  Path,
  Polygon,
  Rect,
  Shadow,
  Text,
  Textbox,
  type FabricObject,
} from 'fabric';
import type { EdgePayload, NodePayload, NodeStyle } from '@mindscape/shared';

const DEFAULT_NODE_BG = '#ffffff';
const DEFAULT_NODE_BORDER = '#e2e8f0';
const DEFAULT_TEXT = '#0f172a';

function isAbstractVisualNode(node: NodePayload): boolean {
  return ['shape', 'path', 'svg', 'gradient_shape'].includes(node.type);
}

function nodeText(node: NodePayload): string {
  if (typeof node.content?.text === 'string' && node.content.text.length > 0) return node.content.text;
  if (typeof node.content?.title === 'string' && node.content.title.length > 0) return node.content.title;
  if (isAbstractVisualNode(node)) return '';
  return node.type.replace(/_/g, ' ');
}

function numberStyle(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function gradientFromStyle(style: NodeStyle | undefined, width: number, height: number) {
  const gradient = style?.gradient;
  const stops = gradient?.colorStops;
  if (!stops || Object.keys(stops).length === 0) return undefined;

  const colorStops = Object.entries(stops).map(([offset, color]) => ({
    offset: Number.parseFloat(offset),
    color,
  }));

  if (gradient?.type === 'radial') {
    return new Gradient({
      type: 'radial',
      coords: {
        x1: width / 2,
        y1: height / 2,
        r1: 0,
        x2: width / 2,
        y2: height / 2,
        r2: Math.max(width, height) / 2,
      },
      colorStops,
    });
  }

  return new Gradient({
    type: 'linear',
    coords: {
      x1: 0,
      y1: 0,
      x2: width,
      y2: height,
    },
    colorStops,
  });
}

function createNodeShape(node: NodePayload): Rect | Path {
  const width = Math.max(80, node.width);
  const height = Math.max(60, node.height);
  const style = node.style ?? {};
  const gradient = gradientFromStyle(style, width, height);
  const fill = gradient ?? style.backgroundColor ?? DEFAULT_NODE_BG;
  const shadow = style.shadow
    ? new Shadow({
        color: style.shadow.color ?? 'rgba(15,23,42,0.16)',
        blur: numberStyle(style.shadow.blur, 8),
        offsetX: numberStyle(style.shadow.offsetX, 2),
        offsetY: numberStyle(style.shadow.offsetY, 2),
      })
    : undefined;

  if (node.type === 'path') {
    const pathData =
      (typeof node.content?.pathData === 'string' && node.content.pathData) ||
      (typeof style.path === 'string' && style.path) ||
      `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} z`;
    return new Path(pathData, {
      left: 0,
      top: 0,
      fill,
      stroke: style.borderColor ?? DEFAULT_NODE_BORDER,
      strokeWidth: numberStyle(style.strokeWidth, 1.5),
      objectCaching: true,
    });
  }

  if (node.type === 'shape' || node.type === 'gradient_shape') {
    const pathData = `M ${width * 0.5} 0 
      L ${width} ${height * 0.5}
      L ${width * 0.5} ${height}
      L 0 ${height * 0.5} z`;
    return new Path(pathData, {
      left: 0,
      top: 0,
      fill,
      stroke: style.borderColor ?? DEFAULT_NODE_BORDER,
      strokeWidth: numberStyle(style.strokeWidth, 1.8),
      opacity: numberStyle(style.opacity, 1),
      shadow,
      objectCaching: true,
    });
  }

  if (node.type === 'text_art') {
    return new Rect({
      left: 0,
      top: 0,
      width,
      height,
      rx: numberStyle(style.borderRadius, 0),
      ry: numberStyle(style.borderRadius, 0),
      fill: 'transparent',
      stroke: 'transparent',
      opacity: numberStyle(style.opacity, 1),
    });
  }

  return new Rect({
    left: 0,
    top: 0,
    width,
    height,
    rx: numberStyle(style.borderRadius, 12),
    ry: numberStyle(style.borderRadius, 12),
    fill,
    stroke: style.borderColor ?? DEFAULT_NODE_BORDER,
    strokeWidth: numberStyle(style.strokeWidth, 1.5),
    opacity: numberStyle(style.opacity, 1),
    shadow,
  });
}

function createNodeText(node: NodePayload): Textbox {
  const width = Math.max(48, node.width - 28);
  const style = node.style ?? {};

  return new Textbox(nodeText(node), {
    left: node.type === 'text_art' ? 6 : 14,
    top: node.type === 'text_art' ? 6 : 12,
    width,
    fontSize: numberStyle(style.fontSize, node.type === 'text_art' ? 36 : node.type === 'code_block' ? 16 : 20),
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : node.type === 'text_art' ? 'Georgia, serif' : 'ui-sans-serif',
    fill: typeof style.textColor === 'string' ? style.textColor : DEFAULT_TEXT,
    textAlign: node.type === 'text_art' ? 'center' : 'left',
    selectable: false,
    evented: false,
    lineHeight: node.type === 'text_art' ? 1.08 : 1.25,
    fontWeight: node.type === 'text_art' ? '700' : '400',
  });
}

function createNodeGroup(node: NodePayload): Group {
  const shape = createNodeShape(node);
  const text = createNodeText(node);
  const objects: FabricObject[] = [shape];
  if (text.text && text.text.trim().length > 0 && !isAbstractVisualNode(node)) {
    objects.push(text);
  }
  const group = new Group(objects, {
    left: node.positionX,
    top: node.positionY,
    angle: node.rotation ?? 0,
    selectable: false,
    evented: false,
  });
  group.set('data', { nodeId: node.id });
  return group;
}

function edgeCenter(node: NodePayload) {
  return {
    x: node.positionX + node.width / 2,
    y: node.positionY + node.height / 2,
  };
}

function createEdgeGroup(edge: EdgePayload, source: NodePayload, target: NodePayload): Group {
  const from = edgeCenter(source);
  const to = edgeCenter(target);
  const style = edge.style ?? {};
  const curve = 36;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - curve;
  const path = new Path(`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`, {
    fill: '',
    stroke: typeof style.color === 'string' ? style.color : '#64748b',
    strokeWidth: numberStyle(style.strokeWidth, 2),
    strokeDashArray: style.dashed ? [8, 5] : undefined,
    selectable: false,
    evented: false,
  });

  const angle = Math.atan2(to.y - midY, to.x - midX);
  const size = 8;
  const triangle = new Polygon(
    [
      { x: 0, y: 0 },
      { x: -size * 1.5, y: size / 2 },
      { x: -size * 1.5, y: -size / 2 },
    ],
    {
      left: to.x,
      top: to.y,
      angle: (angle * 180) / Math.PI,
      fill: typeof style.color === 'string' ? style.color : '#64748b',
      selectable: false,
      evented: false,
    },
  );

  const objects: FabricObject[] = [path, triangle];
  if (edge.label) {
    objects.push(
      new Text(edge.label, {
        left: midX,
        top: midY - 8,
        fontSize: 13,
        fill: '#334155',
        selectable: false,
        evented: false,
      }),
    );
  }

  const group = new Group(objects, { selectable: false, evented: false });
  group.set('data', { edgeId: edge.id });
  return group;
}

export interface RenderedCursor {
  sessionId: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

export class FabricRenderer {
  private readonly nodeObjects = new Map<string, Group>();
  private readonly edgeObjects = new Map<string, Group>();
  private readonly cursorObjects = new Map<string, Group>();

  syncCanvas(canvas: Canvas, nodes: NodePayload[], edges: EdgePayload[], nodeEntranceStarts: Map<string, number>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    for (const [id, object] of this.nodeObjects.entries()) {
      if (!nodeById.has(id)) {
        canvas.remove(object);
        this.nodeObjects.delete(id);
      }
    }

    for (const node of nodes) {
      const existing = this.nodeObjects.get(node.id);
      if (!existing) {
        const next = createNodeGroup(node);
        const startedAt = nodeEntranceStarts.get(node.id);
        if (startedAt && Date.now() - startedAt < 800) {
          next.set({ opacity: 0, scaleX: 0.85, scaleY: 0.85 });
          next.animate(
            { opacity: 1, scaleX: 1, scaleY: 1 },
            {
              duration: 500,
              onChange: () => canvas.requestRenderAll(),
            },
          );
        }
        this.nodeObjects.set(node.id, next);
        canvas.add(next);
      } else {
        this.updateNodeObject(existing, node);
      }
    }

    const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
    for (const [id, object] of this.edgeObjects.entries()) {
      if (!edgeById.has(id)) {
        canvas.remove(object);
        this.edgeObjects.delete(id);
      }
    }

    for (const edge of edges) {
      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);
      if (!source || !target) continue;

      const existing = this.edgeObjects.get(edge.id);
      if (existing) {
        canvas.remove(existing);
      }
      const object = createEdgeGroup(edge, source, target);
      this.edgeObjects.set(edge.id, object);
      canvas.add(object);
      canvas.sendObjectToBack(object);
    }
  }

  syncCursors(canvas: Canvas, cursors: RenderedCursor[]) {
    const nextIds = new Set(cursors.map((cursor) => cursor.sessionId));

    for (const [sessionId, object] of this.cursorObjects.entries()) {
      if (!nextIds.has(sessionId)) {
        canvas.remove(object);
        this.cursorObjects.delete(sessionId);
      }
    }

    for (const cursor of cursors) {
      const existing = this.cursorObjects.get(cursor.sessionId);
      if (!existing) {
        const group = new Group(
          [
            new Circle({
              radius: 7,
              fill: cursor.color,
              left: 0,
              top: 0,
            }),
            new Text(cursor.label, {
              left: 16,
              top: -6,
              fontSize: 12,
              fill: cursor.color,
              fontWeight: '700',
            }),
          ],
          {
            left: cursor.x,
            top: cursor.y,
            selectable: false,
            evented: false,
          },
        );
        group.set('data', { cursorSessionId: cursor.sessionId });
        this.cursorObjects.set(cursor.sessionId, group);
        canvas.add(group);
      } else {
        existing.set({ left: cursor.x, top: cursor.y });
      }
    }
  }

  dispose(canvas: Canvas) {
    for (const object of this.nodeObjects.values()) canvas.remove(object);
    for (const object of this.edgeObjects.values()) canvas.remove(object);
    for (const object of this.cursorObjects.values()) canvas.remove(object);
    this.nodeObjects.clear();
    this.edgeObjects.clear();
    this.cursorObjects.clear();
  }

  private updateNodeObject(object: Group, node: NodePayload) {
    object.set({
      left: node.positionX,
      top: node.positionY,
      angle: node.rotation ?? 0,
    });

    const [shape, text] = object.getObjects();
    if (shape instanceof Rect) {
      const gradient = gradientFromStyle(node.style ?? {}, Math.max(80, node.width), Math.max(60, node.height));
      shape.set({
        width: Math.max(80, node.width),
        height: Math.max(60, node.height),
        rx: numberStyle(node.style?.borderRadius, 12),
        ry: numberStyle(node.style?.borderRadius, 12),
        fill: gradient ?? node.style?.backgroundColor ?? DEFAULT_NODE_BG,
        stroke: node.style?.borderColor ?? DEFAULT_NODE_BORDER,
        strokeWidth: numberStyle(node.style?.strokeWidth, 1.5),
        opacity: numberStyle(node.style?.opacity, 1),
      });
    }
    if (shape instanceof Path) {
      let pathData: string | undefined;
      if (node.type === 'shape' || node.type === 'gradient_shape') {
        const width = Math.max(80, node.width);
        const height = Math.max(60, node.height);
        pathData = `M ${width * 0.5} 0 L ${width} ${height * 0.5} L ${width * 0.5} ${height} L 0 ${height * 0.5} z`;
      } else if (typeof node.content?.pathData === 'string' || typeof node.style?.path === 'string') {
        pathData = (node.content.pathData as string | undefined) || (node.style.path as string | undefined);
      }

      if (pathData) {
        const gradient = gradientFromStyle(node.style ?? {}, Math.max(80, node.width), Math.max(60, node.height));
        shape.set({
          path: new Path(pathData).path,
          fill: gradient ?? node.style?.backgroundColor ?? DEFAULT_NODE_BG,
          stroke: node.style?.borderColor ?? DEFAULT_NODE_BORDER,
          strokeWidth: numberStyle(node.style?.strokeWidth, 1.8),
          opacity: numberStyle(node.style?.opacity, 1),
        });
      }
    }

    if (text instanceof Textbox) {
      text.set({
        text: nodeText(node),
        width: Math.max(48, node.width - 28),
        fontSize: numberStyle(node.style?.fontSize, node.type === 'text_art' ? 36 : node.type === 'code_block' ? 16 : 20),
        fontFamily: typeof node.style?.fontFamily === 'string' ? node.style.fontFamily : node.type === 'text_art' ? 'Georgia, serif' : 'ui-sans-serif',
        fill: typeof node.style?.textColor === 'string' ? node.style.textColor : DEFAULT_TEXT,
        textAlign: node.type === 'text_art' ? 'center' : 'left',
        fontWeight: node.type === 'text_art' ? '700' : '400',
      });
    }

    object.setCoords();
  }
}
