'use client';

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasSocket } from '@/hooks/use-canvas-socket';
import ActivityFeed from './ActivityFeed';
import type { NodePayload, EdgePayload, AgentStatus } from '@mindscape/shared';
import {
  getAgentPersonas,
  getAgentSessions,
  type AgentPersona,
  type AgentSessionSummary,
} from '@/lib/agent-persona-client';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CURSOR_FADE_MS = 3000;

interface SnapshotSummary {
  id: string;
  version: number;
  createdAt: string;
}

interface SnapshotDetail extends SnapshotSummary {
  nodes: NodePayload[];
  edges: EdgePayload[];
}

interface SnapshotDiff {
  nodeAdded: string[];
  nodeRemoved: string[];
  nodeUpdated: string[];
  edgeAdded: string[];
  edgeRemoved: string[];
  edgeUpdated: string[];
}

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
function CanvasNodeRect({
  node,
  highlighted,
  dimmed,
}: {
  node: NodePayload;
  highlighted: boolean;
  dimmed: boolean;
}) {
  const fill = NODE_COLORS[node.type] ?? '#ffffff';
  const textColor = NODE_TEXT_COLORS[node.type] ?? '#333';
  const label = truncate(getNodeTitle(node));

  return (
    <Group x={node.positionX} y={node.positionY} opacity={dimmed ? 0.34 : 1}>
      <Rect
        width={node.width}
        height={node.height}
        fill={fill}
        cornerRadius={10}
        shadowBlur={12}
        shadowColor="rgba(15,23,42,0.12)"
        shadowOffsetY={4}
        stroke={highlighted ? '#0ea5e9' : '#d7dde7'}
        strokeWidth={highlighted ? 3 : 1}
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
  const socketRef = useCanvasSocket(canvasId);

  // Read from Zustand store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const presence = useCanvasStore((s) => s.presence);
  const connected = useCanvasStore((s) => s.connected);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const agentCursors = useCanvasStore((s) => s.agentCursors);
  const pruneStaleAgentCursors = useCanvasStore((s) => s.pruneStaleAgentCursors);
  const agentActivity = useCanvasStore((s) => s.agentActivity);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [snapshotPreview, setSnapshotPreview] = useState<SnapshotDetail | null>(null);
  const [snapshotDiff, setSnapshotDiff] = useState<SnapshotDiff | null>(null);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgeArray = useMemo(() => Array.from(edges.values()), [edges]);
  const orderedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => a.version - b.version),
    [snapshots],
  );
  const selectedSnapshot = useMemo(
    () => (timelineIndex === 0 ? null : orderedSnapshots[timelineIndex - 1] ?? null),
    [orderedSnapshots, timelineIndex],
  );
  const renderNodes = snapshotPreview?.nodes ?? nodeArray;
  const renderEdges = snapshotPreview?.edges ?? edgeArray;
  const renderNodeMap = useMemo(
    () => new Map(renderNodes.map((node) => [node.id, node])),
    [renderNodes],
  );

  useEffect(() => {
    if (timelineIndex > orderedSnapshots.length) {
      setTimelineIndex(orderedSnapshots.length);
    }
  }, [orderedSnapshots.length, timelineIndex]);
  const agentCount = useMemo(() => presence.filter((u) => u.isAgent).length, [presence]);
  const viewerCount = useMemo(() => presence.filter((u) => !u.isAgent).length, [presence]);
  const [canvasTitle, setCanvasTitle] = useState<string>('Canvas');
  const [personas, setPersonas] = useState<AgentPersona[]>([]);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  /* ── window resize ────────────────────────────── */
  const [stageSize, setStageSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateSize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const padding = 220;
    const worldX = -viewport.x / viewport.zoom - padding;
    const worldY = -viewport.y / viewport.zoom - padding;
    const worldW = stageSize.width / viewport.zoom + padding * 2;
    const worldH = stageSize.height / viewport.zoom + padding * 2;

    socket.emit('viewport:update', {
      x: worldX,
      y: worldY,
      w: worldW,
      h: worldH,
      zoom: viewport.zoom,
    });
  }, [socketRef, stageSize.height, stageSize.width, viewport.x, viewport.y, viewport.zoom]);

  useEffect(() => {
    let cancelled = false;

    const loadPersonas = async () => {
      try {
        const next = await getAgentPersonas(canvasId);
        if (!cancelled) setPersonas(next);
      } catch {
        if (!cancelled) setPersonas([]);
      }
    };

    const loadSessions = async () => {
      try {
        const next = await getAgentSessions(canvasId);
        if (!cancelled) setSessions(next);
      } catch {
        if (!cancelled) setSessions([]);
      }
    };

    loadPersonas();
    loadSessions();
    const sessionInterval = window.setInterval(loadSessions, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(sessionInterval);
    };
  }, [canvasId]);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshots = async () => {
      try {
        const res = await fetch(`${API_URL}/canvases/${canvasId}/snapshots?limit=100`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as SnapshotSummary[];
        if (!cancelled) setSnapshots(body);
      } catch {
        if (!cancelled) setSnapshots([]);
      }
    };

    loadSnapshots();
    const interval = window.setInterval(loadSnapshots, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canvasId]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setTick((v) => v + 1);
      pruneStaleAgentCursors(CURSOR_FADE_MS);
    }, 500);
    return () => window.clearInterval(ticker);
  }, [pruneStaleAgentCursors]);

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

  useEffect(() => {
    let cancelled = false;

    const loadSnapshotPreview = async () => {
      if (!selectedSnapshot) {
        setSnapshotPreview(null);
        setSnapshotDiff(null);
        return;
      }

      try {
        const [snapshotRes, diffRes] = await Promise.all([
          fetch(`${API_URL}/canvases/${canvasId}/snapshots/${selectedSnapshot.id}`, { cache: 'no-store' }),
          fetch(`${API_URL}/canvases/${canvasId}/snapshots/${selectedSnapshot.id}/diff`, { cache: 'no-store' }),
        ]);
        if (!snapshotRes.ok) return;
        const snapshotBody = (await snapshotRes.json()) as SnapshotDetail;
        const diffBody = diffRes.ok ? (await diffRes.json()) as SnapshotDiff : null;
        if (!cancelled) {
          setSnapshotPreview(snapshotBody);
          setSnapshotDiff(diffBody);
        }
      } catch {
        if (!cancelled) {
          setSnapshotPreview(null);
          setSnapshotDiff(null);
        }
      }
    };

    loadSnapshotPreview();
    return () => {
      cancelled = true;
    };
  }, [canvasId, selectedSnapshot]);

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
    const bounds = computeContentBounds(renderNodes);
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
  }, [renderNodes, resetView, setViewport, stageSize.height, stageSize.width]);

  const nodeTypes = useMemo(() => {
    return Array.from(new Set(renderNodes.map((node) => node.type))).sort();
  }, [renderNodes]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return renderNodes.filter((node) => {
      const matchesType = typeFilter === 'all' || node.type === typeFilter;
      const contentText = JSON.stringify(node.content ?? {}).toLowerCase();
      const matchesQuery = !q || contentText.includes(q);
      return matchesType && matchesQuery;
    });
  }, [renderNodes, searchQuery, typeFilter]);

  const hasActiveSearch = searchQuery.trim().length > 0 || typeFilter !== 'all';
  const highlightedNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);

  const focusNode = useCallback(
    (node: NodePayload) => {
      const nextZoom = Math.max(0.7, viewport.zoom);
      setViewport({
        zoom: nextZoom,
        x: stageSize.width / 2 - (node.positionX + node.width / 2) * nextZoom,
        y: stageSize.height / 2 - (node.positionY + node.height / 2) * nextZoom,
      });
    },
    [setViewport, stageSize.height, stageSize.width, viewport.zoom],
  );

  const personasByKey = useMemo(() => {
    const map = new Map<string, AgentPersona>();
    for (const persona of personas) {
      map.set(persona.key, persona);
    }
    return map;
  }, [personas]);

  const sessionById = useMemo(() => {
    const map = new Map<string, AgentSessionSummary>();
    for (const session of sessions) {
      map.set(session.id, session);
    }
    return map;
  }, [sessions]);

  const latestStatusBySessionId = useMemo(() => {
    const map = new Map<string, AgentStatus>();
    for (const entry of agentActivity) {
      if (entry.type === 'status') {
        map.set(entry.sessionId, String(entry.data) as AgentStatus);
      }
    }
    return map;
  }, [agentActivity]);

  const activePersonaBadges = useMemo(() => {
    const counts = new Map<string, number>();

    for (const session of sessions) {
      const status = latestStatusBySessionId.get(session.id) ?? session.status;
      if (status === 'thinking' || status === 'acting') {
        counts.set(session.agentName, (counts.get(session.agentName) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([agentKey, count]) => {
      const persona = personasByKey.get(agentKey);
      return {
        key: agentKey,
        count,
        emoji: persona?.emoji ?? '🤖',
        name: persona?.name ?? agentKey,
        color: persona?.color ?? '#64748b',
      };
    });
  }, [latestStatusBySessionId, personasByKey, sessions]);

  const renderedCursors = useMemo(() => {
    const now = Date.now();
    return Array.from(agentCursors.values())
      .map((cursor) => {
        const age = now - cursor.timestamp;
        if (age > CURSOR_FADE_MS) return null;
        const opacity = Math.max(0.18, 1 - age / CURSOR_FADE_MS);
        const session = sessionById.get(cursor.sessionId);
        const persona = session ? personasByKey.get(session.agentName) : undefined;
        return {
          ...cursor,
          opacity,
          emoji: persona?.emoji ?? '🤖',
          label: persona?.name ?? session?.agentName ?? 'Agent',
          color: persona?.color ?? '#64748b',
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);
  }, [agentCursors, personasByKey, sessionById, tick]);

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
          {renderNodes.length} node{renderNodes.length !== 1 ? 's' : ''}
        </span>
      </div>
      {activePersonaBadges.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 62,
            left: 16,
            zIndex: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            maxWidth: 'min(70vw, 680px)',
          }}
        >
          {activePersonaBadges.map((persona) => (
            <div
              key={persona.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                padding: '0.2rem 0.5rem',
                border: `1px solid ${persona.color}66`,
                background: 'rgba(255,255,255,0.9)',
                color: '#334155',
                fontSize: '0.75rem',
              }}
            >
              <span>{persona.emoji}</span>
              <span>{persona.name}</span>
              {persona.count > 1 ? (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#64748b',
                  }}
                >
                  x{persona.count}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          display: 'grid',
          gap: 8,
          width: 'min(340px, calc(100vw - 32px))',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.35)',
            background: 'rgba(255,255,255,0.93)',
            padding: 10,
            display: 'grid',
            gap: 8,
          }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search node content..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              padding: '0.45rem 0.6rem',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                flex: 1,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.5rem',
                background: '#fff',
              }}
            >
              <option value="all">All node types</option>
              {nodeTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              style={{
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
              }}
            >
              Clear
            </button>
          </div>
          {hasActiveSearch ? (
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              {filteredNodes.length} match{filteredNodes.length !== 1 ? 'es' : ''}
            </div>
          ) : null}
          {hasActiveSearch && filteredNodes.length > 0 ? (
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gap: 6 }}>
              {filteredNodes.slice(0, 20).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => focusNode(node)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid #dbeafe',
                    background: '#eff6ff',
                    borderRadius: 8,
                    padding: '0.35rem 0.5rem',
                    color: '#0f172a',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ fontSize: '0.74rem', color: '#0c4a6e' }}>
                    {node.type.replace(/_/g, ' ')}
                  </strong>
                  <div>{truncate(getNodeTitle(node), 80)}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
      </div>

      {!connected ? (
        <div
          style={{
            position: 'absolute',
            top: activePersonaBadges.length > 0 ? 102 : 66,
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
          {renderEdges.map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={renderNodeMap} />
          ))}
        </Layer>

        {/* Nodes layer */}
        <Layer>
          {renderNodes.length === 0 ? (
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
            renderNodes.map((node) => (
              <CanvasNodeRect
                key={node.id}
                node={node}
                highlighted={highlightedNodeIds.has(node.id)}
                dimmed={hasActiveSearch && !highlightedNodeIds.has(node.id)}
              />
            ))
          )}
        </Layer>

        {/* Agent cursors layer */}
        <Layer>
          {renderedCursors.map((cursor) => (
            <Group key={cursor.sessionId} x={cursor.x} y={cursor.y} opacity={cursor.opacity}>
              <Circle radius={7} fill={cursor.color} shadowBlur={6} shadowColor={cursor.color} />
              <Rect
                x={11}
                y={-12}
                height={20}
                width={Math.max(66, cursor.label.length * 7 + 24)}
                cornerRadius={10}
                fill="rgba(15,23,42,0.85)"
              />
              <Text
                x={16}
                y={-9}
                text={`${cursor.emoji} ${cursor.label}`}
                fontSize={11}
                fill="#f8fafc"
                fontStyle="bold"
              />
              <Circle radius={2.5} fill="#f8fafc" />
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

      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          zIndex: 10,
          width: 'min(360px, calc(100vw - 32px))',
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.4)',
          background: 'rgba(255,255,255,0.92)',
          padding: '0.55rem 0.7rem',
          fontSize: '0.75rem',
          color: '#334155',
          fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
          display: 'grid',
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 700 }}>Snapshot Timeline</div>
        <input
          type="range"
          min={0}
          max={orderedSnapshots.length}
          value={Math.min(timelineIndex, orderedSnapshots.length)}
          onChange={(e) => setTimelineIndex(Number(e.target.value))}
        />
        <div>
          {selectedSnapshot
            ? `Viewing snapshot v${selectedSnapshot.version} (${new Date(selectedSnapshot.createdAt).toLocaleString()})`
            : 'Viewing live canvas'}
        </div>
        {snapshotDiff ? (
          <div style={{ color: '#475569' }}>
            Δ nodes +{snapshotDiff.nodeAdded.length} / -{snapshotDiff.nodeRemoved.length} / ~{snapshotDiff.nodeUpdated.length}
            {' · '}
            edges +{snapshotDiff.edgeAdded.length} / -{snapshotDiff.edgeRemoved.length} / ~{snapshotDiff.edgeUpdated.length}
          </div>
        ) : null}
      </div>

      {/* ── Activity feed (viewer-only, no actions) ── */}
      <ActivityFeed personas={personas} sessions={sessions} />
    </div>
  );
}
