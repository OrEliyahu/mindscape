'use client';

import { useEffect, useRef } from 'react';
import { Canvas, Point } from 'fabric';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

interface FabricCanvasProps {
  onCanvasReady: (canvas: Canvas | null) => void;
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
}

function emitViewport(canvas: Canvas, onViewportChange: FabricCanvasProps['onViewportChange']) {
  const zoom = canvas.getZoom() || 1;
  const vt = canvas.viewportTransform;
  const x = vt ? vt[4] : 0;
  const y = vt ? vt[5] : 0;
  onViewportChange({ x, y, zoom });
}

export default function FabricCanvas({ onCanvasReady, onViewportChange }: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const wrapper = wrapperRef.current;
    if (!canvasEl || !wrapper) return;

    const canvas = new Canvas(canvasEl, {
      selection: false,
      renderOnAddRemove: false,
      skipTargetFind: true,
      preserveObjectStacking: true,
    });

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const resize = () => {
      const width = wrapper.clientWidth || window.innerWidth;
      const height = wrapper.clientHeight || window.innerHeight;
      canvas.setDimensions({ width, height });
      emitViewport(canvas, onViewportChange);
      canvas.requestRenderAll();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    resize();

    const onWheel = (opt: { e: WheelEvent | MouseEvent | TouchEvent }) => {
      if (!('deltaY' in opt.e) || !('offsetX' in opt.e) || !('offsetY' in opt.e)) return;
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom() || 1;
      zoom *= 0.999 ** delta;
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
      emitViewport(canvas, onViewportChange);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    };

    const onMouseDown = (opt: { e: MouseEvent | TouchEvent }) => {
      if (!('clientX' in opt.e) || !('clientY' in opt.e)) return;
      isDragging = true;
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
    };

    const onMouseMove = (opt: { e: MouseEvent | TouchEvent }) => {
      if (!isDragging) return;
      if (!('clientX' in opt.e) || !('clientY' in opt.e)) return;
      const vt = canvas.viewportTransform;
      if (!vt) return;
      const dx = opt.e.clientX - lastX;
      const dy = opt.e.clientY - lastY;
      vt[4] += dx;
      vt[5] += dy;
      canvas.setViewportTransform(vt);
      emitViewport(canvas, onViewportChange);
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    onCanvasReady(canvas);

    return () => {
      resizeObserver.disconnect();
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      onCanvasReady(null);
      canvas.dispose();
    };
  }, [onCanvasReady, onViewportChange]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasElRef} />
    </div>
  );
}
