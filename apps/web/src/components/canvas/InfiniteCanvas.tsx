'use client';

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasSocket } from '@/hooks/use-canvas-socket';
import ActivityFeed from './ActivityFeed';
import type { NodePayload, EdgePayload } from '@mindscape/shared';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

function truncate(text: string, max = 220) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function getNodeTitle(node: NodePayload) {
  const content = node.content as { text?: string; title?: string };
  return content.text ?? content.title ?? node.type.replace(/_/g, ' ');
}

function computeContentBounds(nodes: NodePayload[]) {
  if (nodes.length === 0) return null;

  const first = nodes[0];
  let minX = first.positionX;
  let minY = first.positionY;
  let maxX = first.positionX + first.width;
  let maxY = first.positionY + first.height;

  for (const node of nodes) {
    minX = Math.min(minX, node.positionX);
    minY = Math.min(minY, node.positionY);
    maxX = Math.max(maxX, node.positionX + node.width);
    maxY = Math.max(maxY, node.positionY + node.height);
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/* ─── Single canvas node ──────────────────────────── */
function CanvasNodeRect({ node }: { node: NodePayload }) {
  const fill = NODE_COLORS[node.type] ?? '#ffffff';
  const textColor = NODE_TEXT_COLORS[node.type] ?? '#333';
  const label = truncate(getNodeTitle(node));

  return (
    <Group x={node.positionX} y={node.positionY}>
      <Rect
        width={node.width}
        height={node.height}
        fill={fill}
        cornerRadius={10}
        shadowBlur={12}
        shadowColor="rgba(15,23,42,0.12)"
        shadowOffsetY={4}
        stroke="#d7dde7"
        strokeWidth={1}
      />
      <Rect x={0} y={0} width={node.width} height={6} fill="rgba(15,23,42,0.08)" cornerRadius={[10, 10, 0, 0]} />
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
        fontSize={11}
        fill="#64748b"
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
      stroke="#94a3b8"
      strokeWidth={1.2}
      dash={[6, 4]}
      opacity={0.9}
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
  const agentCount = useMemo(() => presence.filter((u) => u.isAgent).length, [presence]);
  const viewerCount = useMemo(() => presence.filter((u) => !u.isAgent).length, [presence]);
  const [canvasTitle, setCanvasTitle] = useState<string>('Canvas');

  /* ── window resize ────────────────────────────── */
  const [stageSize, setStageSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateSize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCanvas = async () => {
      try {
        const res = await fetch(`${API_URL}/canvases/${canvasId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { title?: string };
        if (!cancelled && body.title) setCanvasTitle(body.title);
      } catch {
        // Keep fallback title if request fails.
      }
    };
    loadCanvas();
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

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

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [setViewport]);

  const fitToContent = useCallback(() => {
    const bounds = computeContentBounds(nodeArray);
    if (!bounds) {
      resetView();
      return;
    }

    const padding = 160;
    const fitX = stageSize.width / Math.max(1, bounds.width + padding);
    const fitY = stageSize.height / Math.max(1, bounds.height + padding);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(fitX, fitY)));

    setViewport({
      zoom: nextZoom,
      x: stageSize.width / 2 - (bounds.minX + bounds.width / 2) * nextZoom,
      y: stageSize.height / 2 - (bounds.minY + bounds.height / 2) * nextZoom,
    });
  }, [nodeArray, resetView, setViewport, stageSize.height, stageSize.width]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background:
          'radial-gradient(circle at 16% 20%, #e0f2fe 0, transparent 35%), radial-gradient(circle at 84% 12%, #dcfce7 0, transparent 30%), #f8fafc',
      }}
    >
      {/* ── HUD overlay ─────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          padding: '10px 14px',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 700 }}>{canvasTitle}</span>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
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
        <span style={{ color: '#475569', fontSize: '0.82rem' }}>
          {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#475569', fontSize: '0.82rem' }}>
          {agentCount} agent{agentCount !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
          {nodeArray.length} node{nodeArray.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={fitToContent}
          style={{
            cursor: 'pointer',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: 'rgba(255,255,255,0.92)',
            padding: '0.45rem 0.7rem',
            color: '#0f172a',
            fontSize: '0.8rem',
          }}
        >
          Fit
        </button>
        <button
          type="button"
          onClick={resetView}
          style={{
            cursor: 'pointer',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: 'rgba(255,255,255,0.92)',
            padding: '0.45rem 0.7rem',
            color: '#0f172a',
            fontSize: '0.8rem',
          }}
        >
          Reset
        </button>
      </div>

      {!connected ? (
        <div
          style={{
            position: 'absolute',
            top: 66,
            left: 16,
            zIndex: 10,
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '0.45rem 0.7rem',
            fontSize: '0.78rem',
          }}
        >
          Reconnecting to live updates...
        </div>
      ) : null}

      {/* ── Konva stage ─────────────────────────── */}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)',
          backgroundSize: `${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
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

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          zIndex: 10,
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.4)',
          background: 'rgba(255,255,255,0.86)',
          color: '#475569',
          padding: '0.4rem 0.55rem',
          fontSize: '0.75rem',
          fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
        }}
      >
        Scroll to zoom. Drag to pan. Viewers are read-only.
      </div>

      {/* ── Activity feed (viewer-only, no actions) ── */}
      <ActivityFeed />
    </div>
  );
}
