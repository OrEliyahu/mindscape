import type { Viewport } from './canvas-types';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isInViewport(node: BoundingBox, viewport: BoundingBox): boolean {
  return (
    node.x + node.width >= viewport.x &&
    node.x <= viewport.x + viewport.width &&
    node.y + node.height >= viewport.y &&
    node.y <= viewport.y + viewport.height
  );
}

export function viewportToWorldBounds(
  screenWidth: number,
  screenHeight: number,
  viewport: Viewport,
): BoundingBox {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: screenWidth / viewport.zoom,
    height: screenHeight / viewport.zoom,
  };
}

export function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function centerOf(box: BoundingBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
