'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';

const InfiniteCanvas = dynamic(() => import('@/components/canvas/InfiniteCanvas'), { ssr: false });

export default function CanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <InfiniteCanvas canvasId={id} />;
}
