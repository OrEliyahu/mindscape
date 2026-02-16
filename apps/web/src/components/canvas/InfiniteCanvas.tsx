'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasSocket } from '@/hooks/use-canvas-socket';
import ActivityFeed from './ActivityFeed';
import {
  getAgentPersonas,
  getAgentSessions,
  type AgentPersona,
  type AgentSessionSummary,
} from '@/lib/agent-persona-client';
import { mapAgentCursorsToCollaborators, mapCanvasToExcalidrawElements } from '@/lib/excalidraw-mapper';

const ExcalidrawView = dynamic(() => import('./ExcalidrawView'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CURSOR_FADE_MS = 3000;
const AUTO_FOLLOW_COOLDOWN_MS = 10000;
const AUTO_FOLLOW_DURATION_MS = 2000;
const NODE_ENTRANCE_MS = 500;

interface CursorState {
  x: number;
  y: number;
  timestamp: number;
}

export default function InfiniteCanvas({ canvasId }: { canvasId: string }) {
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const initializedNodesRef = useRef(false);
  const knownNodeIdsRef = useRef<Set<string>>(new Set());
  const lastPanAtRef = useRef(0);
  const isAutoFollowingRef = useRef(false);
  const followAnimationRef = useRef<number | null>(null);
  const lastScrollRef = useRef<{ x: number; y: number } | null>(null);

  useCanvasSocket(canvasId);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const presence = useCanvasStore((s) => s.presence);
  const connected = useCanvasStore((s) => s.connected);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const agentCursors = useCanvasStore((s) => s.agentCursors);
  const pruneStaleAgentCursors = useCanvasStore((s) => s.pruneStaleAgentCursors);

  const [canvasTitle, setCanvasTitle] = useState<string>('Canvas');
  const [personas, setPersonas] = useState<AgentPersona[]>([]);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [tick, setTick] = useState(0);
  const [interpolatedCursors, setInterpolatedCursors] = useState<Map<string, CursorState>>(new Map());
  const [nodeEntranceStarts, setNodeEntranceStarts] = useState<Map<string, number>>(new Map());

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgeArray = useMemo(() => Array.from(edges.values()), [edges]);

  const agentCount = useMemo(() => presence.filter((u) => u.isAgent).length, [presence]);
  const viewerCount = useMemo(() => presence.filter((u) => !u.isAgent).length, [presence]);

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

  useEffect(() => {
    let cancelled = false;

    const loadCanvas = async () => {
      try {
        const res = await fetch(`${API_URL}/canvases/${canvasId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { title?: string };
        if (!cancelled && body.title) setCanvasTitle(body.title);
      } catch {
        // keep fallback title
      }
    };

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

    void loadCanvas();
    void loadPersonas();
    void loadSessions();

    const intervalId = window.setInterval(() => {
      void loadSessions();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canvasId]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setTick((value) => value + 1);
      pruneStaleAgentCursors(CURSOR_FADE_MS);
    }, 100);

    return () => window.clearInterval(ticker);
  }, [pruneStaleAgentCursors]);

  useEffect(() => {
    let mounted = true;
    let rafId = 0;

    const animate = () => {
      if (!mounted) return;

      setInterpolatedCursors((current) => {
        const now = Date.now();
        const next = new Map<string, CursorState>();

        for (const [sessionId, cursor] of agentCursors.entries()) {
          const prev = current.get(sessionId);
          const startX = prev?.x ?? cursor.x;
          const startY = prev?.y ?? cursor.y;
          const x = startX + (cursor.x - startX) * 0.2;
          const y = startY + (cursor.y - startY) * 0.2;
          next.set(sessionId, { x, y, timestamp: cursor.timestamp || now });
        }

        return next;
      });

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      mounted = false;
      window.cancelAnimationFrame(rafId);
    };
  }, [agentCursors]);

  useEffect(() => {
    setNodeEntranceStarts((previous) => {
      const next = new Map(previous);
      const now = Date.now();

      for (const node of nodeArray) {
        if (!next.has(node.id)) {
          next.set(node.id, now);
        }
      }

      for (const nodeId of next.keys()) {
        if (!nodes.has(nodeId)) next.delete(nodeId);
      }

      return next;
    });
  }, [nodeArray, nodes]);

  const animateCameraToNode = useCallback((nodeId: string) => {
    const api = excalidrawApiRef.current;
    const node = nodes.get(nodeId);
    if (!api || !node) return;

    const now = Date.now();
    if (now - lastPanAtRef.current < AUTO_FOLLOW_COOLDOWN_MS) return;

    const appState = api.getAppState();
    const fromX = appState.scrollX;
    const fromY = appState.scrollY;
    const viewportWidth = appState.width || window.innerWidth;
    const viewportHeight = appState.height || window.innerHeight;
    const toX = viewportWidth / 2 - (node.positionX + node.width / 2);
    const toY = viewportHeight / 2 - (node.positionY + node.height / 2);

    if (followAnimationRef.current !== null) {
      window.cancelAnimationFrame(followAnimationRef.current);
    }

    const startAt = performance.now();
    isAutoFollowingRef.current = true;

    const step = (time: number) => {
      const elapsed = time - startAt;
      const progress = Math.min(1, elapsed / AUTO_FOLLOW_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const scrollX = fromX + (toX - fromX) * eased;
      const scrollY = fromY + (toY - fromY) * eased;

      api.updateScene({ appState: { scrollX, scrollY } as never });
      setViewport({ x: scrollX, y: scrollY, zoom: appState.zoom.value });

      if (progress < 1) {
        followAnimationRef.current = window.requestAnimationFrame(step);
      } else {
        isAutoFollowingRef.current = false;
        followAnimationRef.current = null;
      }
    };

    followAnimationRef.current = window.requestAnimationFrame(step);
  }, [nodes, setViewport]);

  useEffect(() => {
    if (!initializedNodesRef.current) {
      knownNodeIdsRef.current = new Set(nodeArray.map((node) => node.id));
      initializedNodesRef.current = true;
      return;
    }

    const known = knownNodeIdsRef.current;
    const nextKnown = new Set(known);
    let latestCreatedNodeId: string | null = null;

    for (const node of nodeArray) {
      if (!known.has(node.id)) {
        latestCreatedNodeId = node.id;
        nextKnown.add(node.id);
      }
    }

    for (const id of Array.from(nextKnown)) {
      if (!nodes.has(id)) nextKnown.delete(id);
    }

    knownNodeIdsRef.current = nextKnown;

    if (latestCreatedNodeId) {
      animateCameraToNode(latestCreatedNodeId);
    }
  }, [animateCameraToNode, nodeArray, nodes]);

  useEffect(() => {
    return () => {
      if (followAnimationRef.current !== null) {
        window.cancelAnimationFrame(followAnimationRef.current);
      }
    };
  }, []);

  const nodeOpacityById = useMemo(() => {
    const now = Date.now();
    const opacity = new Map<string, number>();

    for (const node of nodeArray) {
      const startedAt = nodeEntranceStarts.get(node.id);
      if (!startedAt) {
        opacity.set(node.id, 100);
        continue;
      }
      const progress = Math.min(1, (now - startedAt) / NODE_ENTRANCE_MS);
      opacity.set(node.id, Math.max(0, Math.round(progress * 100)));
    }

    return opacity;
  }, [nodeArray, nodeEntranceStarts, tick]);

  const sceneElements = useMemo(
    () => mapCanvasToExcalidrawElements(nodeArray, edgeArray, nodeOpacityById),
    [edgeArray, nodeArray, nodeOpacityById],
  );

  const collaborators = useMemo(() => {
    const now = Date.now();
    const cursorEntries = Array.from(interpolatedCursors.entries())
      .map(([sessionId, cursor]) => {
        const age = now - cursor.timestamp;
        if (age > CURSOR_FADE_MS) return null;

        const session = sessionById.get(sessionId);
        const persona = session ? personasByKey.get(session.agentName) : undefined;

        return {
          sessionId,
          x: cursor.x,
          y: cursor.y,
          updatedAt: cursor.timestamp,
          label: persona?.name ?? session?.agentName ?? 'Agent',
          color: persona?.color ?? '#64748b',
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return mapAgentCursorsToCollaborators(cursorEntries);
  }, [interpolatedCursors, personasByKey, sessionById, tick]);

  useEffect(() => {
    if (!excalidrawApiRef.current) return;

    excalidrawApiRef.current.updateScene({
      elements: sceneElements as never,
      collaborators,
    });
  }, [sceneElements, collaborators]);

  const handleExcalidrawChange = (appState: AppState) => {
    const previous = lastScrollRef.current;
    const changed = !previous || Math.abs(previous.x - appState.scrollX) > 0.5 || Math.abs(previous.y - appState.scrollY) > 0.5;

    if (!isAutoFollowingRef.current && changed) {
      lastPanAtRef.current = Date.now();
    }

    lastScrollRef.current = { x: appState.scrollX, y: appState.scrollY };

    setViewport({
      x: appState.scrollX,
      y: appState.scrollY,
      zoom: appState.zoom.value,
    });
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background:
          'radial-gradient(circle at 16% 20%, #e0f2fe 0, transparent 35%), radial-gradient(circle at 84% 12%, #dcfce7 0, transparent 30%), #f8fafc',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          padding: '0.38rem 0.72rem',
          borderRadius: 999,
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.75rem',
        }}
      >
        <strong>{canvasTitle}</strong>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10B981',
            display: 'inline-block',
          }}
        />
        <span style={{ color: '#475569' }}>
          {agentCount} agents · {viewerCount} viewers
        </span>
      </div>

      {!connected ? (
        <div
          style={{
            position: 'absolute',
            top: 64,
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

      <ExcalidrawView
        onApi={(api) => {
          excalidrawApiRef.current = api;
        }}
        onSceneChange={handleExcalidrawChange}
      />

      <ActivityFeed personas={personas} sessions={sessions} />
    </div>
  );
}
