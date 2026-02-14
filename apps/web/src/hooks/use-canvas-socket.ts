'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mindscape/shared';
import { useCanvasStore } from '@/stores/canvas-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

/**
 * Hook that connects to the canvas WebSocket namespace and feeds
 * all server-pushed events into the Zustand store.
 *
 * The client is **receive-only** — it never sends node mutations.
 * All canvas changes come from backend agents.
 */
export function useCanvasSocket(canvasId: string) {
  const socketRef = useRef<TypedSocket | null>(null);

  const setConnected = useCanvasStore((s) => s.setConnected);
  const setCanvasState = useCanvasStore((s) => s.setCanvasState);
  const addNode = useCanvasStore((s) => s.addNode);
  const patchNode = useCanvasStore((s) => s.patchNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const setPresence = useCanvasStore((s) => s.setPresence);
  const pushAgentActivity = useCanvasStore((s) => s.pushAgentActivity);

  useEffect(() => {
    const socket: TypedSocket = io(`${WS_URL}/canvas`, {
      transports: ['websocket'],
      auth: {
        userId: crypto.randomUUID(),
        name: 'Viewer',
      },
    });

    socketRef.current = socket;

    /* ── connection lifecycle ─────────────────────── */
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-canvas', { canvasId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    /* ── canvas state (initial load) ─────────────── */
    socket.on('canvas:state', ({ nodes, edges }) => {
      setCanvasState(nodes, edges);
    });

    /* ── node events (pushed by agents) ──────────── */
    socket.on('node:created', ({ node }) => addNode(node));
    socket.on('node:updated', ({ id, patch }) => patchNode(id, patch));
    socket.on('node:deleted', ({ id }) => removeNode(id));

    /* ── edge events ─────────────────────────────── */
    socket.on('edge:created', ({ edge }) => addEdge(edge));
    socket.on('edge:deleted', ({ id }) => removeEdge(id));

    /* ── presence ────────────────────────────────── */
    socket.on('presence:update', ({ users }) => setPresence(users));

    /* ── agent activity feed ─────────────────────── */
    socket.on('agent:status', (data) =>
      pushAgentActivity({ sessionId: data.sessionId, type: 'status', data: data.status, timestamp: Date.now() }),
    );
    socket.on('agent:thought', (data) =>
      pushAgentActivity({ sessionId: data.sessionId, type: 'thought', data: data.text, timestamp: Date.now() }),
    );
    socket.on('agent:tool-call', (data) =>
      pushAgentActivity({ sessionId: data.sessionId, type: 'tool-call', data, timestamp: Date.now() }),
    );
    socket.on('agent:error', (data) =>
      pushAgentActivity({ sessionId: data.sessionId, type: 'error', data: data.error, timestamp: Date.now() }),
    );

    /* ── cleanup ─────────────────────────────────── */
    return () => {
      socket.emit('leave-canvas', { canvasId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [
    canvasId,
    setConnected,
    setCanvasState,
    addNode,
    patchNode,
    removeNode,
    addEdge,
    removeEdge,
    setPresence,
    pushAgentActivity,
  ]);

  return socketRef;
}
