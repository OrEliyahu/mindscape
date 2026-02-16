'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function InfiniteCanvas({ canvasId }: { canvasId: string }) {
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

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
    }, 500);

    return () => window.clearInterval(ticker);
  }, [pruneStaleAgentCursors]);

  const sceneElements = useMemo(
    () => mapCanvasToExcalidrawElements(nodeArray, edgeArray),
    [edgeArray, nodeArray],
  );

  const collaborators = useMemo(() => {
    const now = Date.now();
    const cursorEntries = Array.from(agentCursors.values())
      .map((cursor) => {
        const age = now - cursor.timestamp;
        if (age > CURSOR_FADE_MS) return null;

        const session = sessionById.get(cursor.sessionId);
        const persona = session ? personasByKey.get(session.agentName) : undefined;

        return {
          sessionId: cursor.sessionId,
          x: cursor.x,
          y: cursor.y,
          updatedAt: cursor.timestamp,
          label: persona?.name ?? session?.agentName ?? 'Agent',
          color: persona?.color ?? '#64748b',
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return mapAgentCursorsToCollaborators(cursorEntries);
  }, [agentCursors, personasByKey, sessionById, tick]);

  useEffect(() => {
    if (!excalidrawApiRef.current) return;

    excalidrawApiRef.current.updateScene({
      elements: sceneElements as never,
      collaborators,
    });
  }, [sceneElements, collaborators]);

  const handleExcalidrawChange = (appState: AppState) => {
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
