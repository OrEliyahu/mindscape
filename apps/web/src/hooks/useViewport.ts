'use client';

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import type Konva from 'konva';
import type { Viewport } from '@mindscape/shared';
import { useCanvasStore } from '../stores/canvas-store';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_FACTOR = 1.08;

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function useViewport() {
  const { viewport, updateViewport } = useCanvasStore(
    useShallow((s) => ({
      viewport: s.viewport,
      updateViewport: s.updateViewport,
    })),
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const oldZoom = viewport.zoom;
      const newZoom = clampZoom(direction > 0 ? oldZoom * ZOOM_FACTOR : oldZoom / ZOOM_FACTOR);

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldZoom,
        y: (pointer.y - viewport.y) / oldZoom,
      };

      updateViewport({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
        zoom: newZoom,
      });
    },
    [viewport, updateViewport],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      updateViewport({
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [updateViewport],
  );

  return useMemo(
    () => ({
      viewport,
      handleWheel,
      handleDragEnd,
    }),
    [viewport, handleWheel, handleDragEnd],
  );
}
