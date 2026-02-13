'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import type { CreateNodePayload, CanvasNode } from '@mindscape/shared';
import { useSocket } from './useSocket';
import { useCanvasStore } from '../stores/canvas-store';

export function useCanvas(canvasId: string) {
  const socket = useSocket();

  const { nodes, edges, selectedIds, setNodes, setEdges, addNode, updateNode: storeUpdateNode, removeNode, setSelection } =
    useCanvasStore(
      useShallow((s) => ({
        nodes: s.nodes,
        edges: s.edges,
        selectedIds: s.selectedIds,
        setNodes: s.setNodes,
        setEdges: s.setEdges,
        addNode: s.addNode,
        updateNode: s.updateNode,
        removeNode: s.removeNode,
        setSelection: s.setSelection,
      })),
    );

  useEffect(() => {
    socket.emit('join-canvas', { canvasId });

    socket.on('canvas:state', ({ nodes: incomingNodes, edges: incomingEdges }) => {
      setNodes(incomingNodes);
      setEdges(incomingEdges);
    });

    socket.on('node:created', ({ node }) => {
      addNode(node);
    });

    socket.on('node:updated', ({ id, patch }) => {
      storeUpdateNode(id, patch);
    });

    socket.on('node:deleted', ({ id }) => {
      removeNode(id);
    });

    return () => {
      socket.emit('leave-canvas', { canvasId });
      socket.off('canvas:state');
      socket.off('node:created');
      socket.off('node:updated');
      socket.off('node:deleted');
    };
  }, [canvasId, socket, setNodes, setEdges, addNode, storeUpdateNode, removeNode]);

  const createNode = useCallback(
    (payload: CreateNodePayload) => {
      socket.emit('node:create', { node: payload });
    },
    [socket],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      socket.emit('node:update', { id, patch });
    },
    [socket],
  );

  const deleteNode = useCallback(
    (id: string) => {
      socket.emit('node:delete', { id });
    },
    [socket],
  );

  const changeSelection = useCallback(
    (ids: string[]) => {
      setSelection(ids);
      socket.emit('selection:change', { nodeIds: ids });
    },
    [socket, setSelection],
  );

  return useMemo(
    () => ({
      nodes,
      edges,
      selectedIds,
      createNode,
      updateNode,
      deleteNode,
      setSelection: changeSelection,
    }),
    [nodes, edges, selectedIds, createNode, updateNode, deleteNode, changeSelection],
  );
}
