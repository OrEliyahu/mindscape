'use client';

import { useRef, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import type Konva from 'konva';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

const GRID_SIZE = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export default function InfiniteCanvas({ canvasId }: { canvasId: string }) {
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const oldZoom = viewport.zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, direction > 0 ? oldZoom * factor : oldZoom / factor));

    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldZoom,
      y: (pointer.y - viewport.y) / oldZoom,
    };

    setViewport({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
      zoom: newZoom,
    });
  }, [viewport]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setViewport((prev) => ({
      ...prev,
      x: e.target.x(),
      y: e.target.y(),
    }));
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#fafafa' }}>
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        background: 'white', padding: '8px 16px', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'system-ui',
      }}>
        <span style={{ fontWeight: 600 }}>Mindscape</span>
        <span style={{ color: '#999', marginLeft: 8, fontSize: '0.85rem' }}>
          {Math.round(viewport.zoom * 100)}% | Canvas: {canvasId}
        </span>
      </div>

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
        <Layer>
          <Rect x={0} y={0} width={200} height={120} fill="#fff3bf" cornerRadius={8} shadowBlur={4} shadowColor="rgba(0,0,0,0.1)" />
          <Text x={16} y={16} text="Welcome to Mindscape" fontSize={16} fontStyle="bold" />
          <Text x={16} y={44} text="Pan: drag the canvas\nZoom: scroll wheel" fontSize={13} fill="#666" lineHeight={1.4} />
        </Layer>
      </Stage>
    </div>
  );
}
