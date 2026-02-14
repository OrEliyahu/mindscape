'use client';

import { useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasSocket } from '@/hooks/use-canvas-socket';
import type { NodePayload, EdgePayload } from '@mindscape/shared';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

/* ─── Node type → colour mapping ──────────────────── */
const NODE_COLORS: Record<string, string> = {
  sticky_note: '#fff3bf',
  text_block: '#ffffff',
  code_block: '#1e1e2e',
  ai_response: '#e8f5e9',
  image: '#f3e5f5',
  shape: '#e3f2fd',
  drawing: '#fce4ec',
  group: '#f5f5f5',
};

const NODE_TEXT_COLORS: Record<string, string> = {
  code_block: '#c6d0f5',
};

/* ─── Single canvas node ──────────────────────────── */
function CanvasNodeRect({ node }: { node: NodePayload }) {
  const fill = NODE_COLORS[node.type] ?? '#ffffff';
  const textColor = NODE_TEXT_COLORS[node.type] ?? '#333';
  const label =
    (node.content?.text as string) ??
    (node.content?.title as string) ??
    node.type.replace(/_/g, ' ');

  return (
    <Group x={node.positionX} y={node.positionY}>
      <Rect
        width={node.width}
        height={node.height}
        fill={fill}
        cornerRadius={8}
        shadowBlur={6}
        shadowColor="rgba(0,0,0,0.08)"
        shadowOffsetY={2}
        stroke="#e0e0e0"
        strokeWidth={1}
      />
      <Text
        x={12}
        y={12}
        width={node.width - 24}
        text={label}
        fontSize={14}
        fill={textColor}
        wrap="word"
        ellipsis
      />
      {/* Type badge */}
      <Text
        x={12}
        y={node.height - 24}
        text={node.type.replace(/_/g, ' ')}
        fontSize={10}
        fill="#aaa"
      />
    </Group>
  );
}

/* ─── Edge line between two nodes ─────────────────── */
function EdgeLine({ edge, nodes }: { edge: EdgePayload; nodes: Map<string, NodePayload> }) {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);
  if (!source || !target) return null;

  const sx = source.positionX + source.width / 2;
  const sy = source.positionY + source.height / 2;
  const tx = target.positionX + target.width / 2;
  const ty = target.positionY + target.height / 2;

  return (
    <Line
      points={[sx, sy, tx, ty]}
      stroke="#bbb"
      strokeWidth={1.5}
      dash={[6, 4]}
    />
  );
}

/* ─── Main canvas component ───────────────────────── */
export default function InfiniteCanvas({ canvasId }: { canvasId: string }) {
  const stageRef = useRef<Konva.Stage>(null);

  // Connect to the WebSocket (receive-only)
  useCanvasSocket(canvasId);

  // Read from Zustand store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const presence = useCanvasStore((s) => s.presence);
  const connected = useCanvasStore((s) => s.connected);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgeArray = useMemo(() => Array.from(edges.values()), [edges]);

  /* ── zoom ──────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      const oldZoom = viewport.zoom;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, direction > 0 ? oldZoom * factor : oldZoom / factor),
      );

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldZoom,
        y: (pointer.y - viewport.y) / oldZoom,
      };

      setViewport({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
        zoom: newZoom,
      });
    },
    [viewport, setViewport],
  );

  /* ── pan ───────────────────────────────────────── */
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      setViewport({
        ...viewport,
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [viewport, setViewport],
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#fafafa' }}>
      {/* ── HUD overlay ─────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'white',
          padding: '8px 16px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontFamily: 'system-ui',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 600 }}>Mindscape</span>
        <span style={{ color: '#999', fontSize: '0.85rem' }}>
          {Math.round(viewport.zoom * 100)}%
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#10B981' : '#EF4444',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#999', fontSize: '0.8rem' }}>
          {presence.length} viewer{presence.length !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#ccc', fontSize: '0.75rem' }}>
          {nodeArray.length} node{nodeArray.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Konva stage ─────────────────────────── */}
      <Stage
        ref={stageRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 1200}
        height={typeof window !== 'undefined' ? window.innerHeight : 800}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
      >
        {/* Edges layer (behind nodes) */}
        <Layer>
          {edgeArray.map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={nodes} />
          ))}
        </Layer>

        {/* Nodes layer */}
        <Layer>
          {nodeArray.length === 0 ? (
            // Empty state
            <Group>
              <Rect
                x={-100}
                y={-60}
                width={200}
                height={120}
                fill="#fff3bf"
                cornerRadius={8}
                shadowBlur={4}
                shadowColor="rgba(0,0,0,0.1)"
              />
              <Text
                x={-84}
                y={-44}
                text="Waiting for agents..."
                fontSize={16}
                fontStyle="bold"
              />
              <Text
                x={-84}
                y={-16}
                text={"Nodes will appear here as\nbackend agents create them."}
                fontSize={13}
                fill="#666"
                lineHeight={1.4}
              />
            </Group>
          ) : (
            nodeArray.map((node) => <CanvasNodeRect key={node.id} node={node} />)
          )}
        </Layer>

        {/* Agent cursors layer */}
        <Layer>
          {presence
            .filter((u) => u.isAgent && u.cursorX !== 0 && u.cursorY !== 0)
            .map((agent) => (
              <Group key={agent.id} x={agent.cursorX} y={agent.cursorY}>
                <Circle radius={6} fill={agent.color} opacity={0.8} />
                <Text
                  x={10}
                  y={-6}
                  text={agent.name}
                  fontSize={11}
                  fill={agent.color}
                  fontStyle="bold"
                />
              </Group>
            ))}
        </Layer>
      </Stage>
    </div>
  );
}
