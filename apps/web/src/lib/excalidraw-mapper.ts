import type { Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import type { EdgePayload, NodePayload } from '@mindscape/shared';

const NODE_COLORS: Record<string, string> = {
  sticky_note: '#fff3bf',
  text_block: '#ffffff',
  code_block: '#d0ebff',
  ai_response: '#d3f9d8',
  image: '#fff4e6',
  shape: '#e5dbff',
  drawing: '#ffe3e3',
  group: '#f1f3f5',
};

const NODE_TEXT_COLORS: Record<string, string> = {
  code_block: '#1f2a44',
  image: '#364152',
};

const SHAPE_BY_TYPE: Record<string, 'rectangle' | 'ellipse' | 'diamond'> = {
  sticky_note: 'rectangle',
  text_block: 'rectangle',
  code_block: 'rectangle',
  ai_response: 'ellipse',
  image: 'rectangle',
  drawing: 'ellipse',
  shape: 'diamond',
  group: 'diamond',
};

function createNonce(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function baseElement(id: string, type: string, x: number, y: number, width: number, height: number) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1f2937',
    backgroundColor: '#ffffff',
    fillStyle: 'hachure',
    strokeWidth: 1.4,
    strokeStyle: 'solid',
    roughness: 2,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: createNonce(`${id}:seed`),
    version: 1,
    versionNonce: createNonce(`${id}:nonce`),
    isDeleted: false,
    updated: Date.now(),
    boundElements: null,
    locked: true,
    link: null,
    customData: null,
  };
}

function toText(node: NodePayload): string {
  const content = node.content as Record<string, unknown> | undefined;
  const title = typeof content?.title === 'string' ? content.title : undefined;
  const text = typeof content?.text === 'string' ? content.text : undefined;
  if (text && text.length > 0) return text;
  if (title && title.length > 0) return title;
  return node.type.replace(/_/g, ' ');
}

function shapeElementFromNode(node: NodePayload) {
  return {
    ...baseElement(
      `${node.id}__shape`,
      SHAPE_BY_TYPE[node.type] ?? 'rectangle',
      node.positionX,
      node.positionY,
      Math.max(80, node.width),
      Math.max(60, node.height),
    ),
    backgroundColor: NODE_COLORS[node.type] ?? '#ffffff',
  };
}

function textElementFromNode(node: NodePayload) {
  return {
    ...baseElement(
      `${node.id}__text`,
      'text',
      node.positionX + 14,
      node.positionY + 12,
      Math.max(32, node.width - 28),
      Math.max(24, node.height - 24),
    ),
    strokeColor: NODE_TEXT_COLORS[node.type] ?? '#111827',
    backgroundColor: 'transparent',
    roughness: 1,
    text: toText(node),
    fontSize: node.type === 'code_block' ? 16 : 20,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: 16,
    lineHeight: 1.25,
    containerId: null,
    originalText: toText(node),
    autoResize: true,
  };
}

function arrowElementFromEdge(
  edge: EdgePayload,
  source: NodePayload | undefined,
  target: NodePayload | undefined,
) {
  if (!source || !target) return null;

  const sx = source.positionX + source.width / 2;
  const sy = source.positionY + source.height / 2;
  const tx = target.positionX + target.width / 2;
  const ty = target.positionY + target.height / 2;

  return {
    ...baseElement(edge.id, 'arrow', sx, sy, Math.max(1, tx - sx), Math.max(1, ty - sy)),
    strokeColor: '#64748b',
    backgroundColor: 'transparent',
    points: [[0, 0], [tx - sx, ty - sy]],
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    elbows: [],
    label: edge.label
      ? {
          text: edge.label,
          fontSize: 18,
          fontFamily: 1,
          textAlign: 'center',
          verticalAlign: 'middle',
        }
      : null,
  };
}

export function mapCanvasToExcalidrawElements(nodes: NodePayload[], edges: EdgePayload[]): ReadonlyArray<Record<string, unknown>> {
  const elements: Array<Record<string, unknown>> = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    elements.push(shapeElementFromNode(node));
    elements.push(textElementFromNode(node));
  }

  for (const edge of edges) {
    const arrow = arrowElementFromEdge(edge, nodeById.get(edge.sourceId), nodeById.get(edge.targetId));
    if (arrow) elements.push(arrow);
  }

  return elements;
}

export function mapAgentCursorsToCollaborators(
  cursors: Array<{ sessionId: string; x: number; y: number; label: string; color: string; updatedAt: number }>,
): Map<SocketId, Collaborator> {
  const collaborators = new Map<SocketId, Collaborator>();
  for (const cursor of cursors) {
    const socketId = cursor.sessionId as SocketId;
    collaborators.set(socketId, {
      username: cursor.label,
      pointer: { x: cursor.x, y: cursor.y, tool: 'pointer' },
      color: { background: cursor.color, stroke: '#111827' },
      id: cursor.sessionId,
      socketId,
    });
  }
  return collaborators;
}
