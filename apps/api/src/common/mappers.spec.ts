import { toCanvasPayload, toEdgePayload, toNodePayload } from './mappers';

describe('mappers', () => {
  it('maps node row to payload', () => {
    const payload = toNodePayload({
      id: 'n1',
      canvas_id: 'c1',
      type: 'sticky_note',
      position_x: 10,
      position_y: 20,
      width: 200,
      height: 120,
      rotation: 0,
      z_index: 1,
      content: { text: 'hello' },
      style: { color: 'yellow' },
      locked: false,
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    expect(payload).toMatchObject({
      id: 'n1',
      canvasId: 'c1',
      positionX: 10,
      positionY: 20,
      zIndex: 1,
      content: { text: 'hello' },
    });
  });

  it('maps edge row to payload', () => {
    const payload = toEdgePayload({
      id: 'e1',
      canvas_id: 'c1',
      source_id: 'n1',
      target_id: 'n2',
      label: 'connects',
      style: {},
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(payload).toEqual({
      id: 'e1',
      canvasId: 'c1',
      sourceId: 'n1',
      targetId: 'n2',
      label: 'connects',
      style: {},
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('maps canvas row to payload', () => {
    const payload = toCanvasPayload({
      id: 'c1',
      title: 'Roadmap',
      owner_id: 'u1',
      viewport: { x: 0, y: 0, zoom: 1 },
      settings: { theme: 'light' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    expect(payload).toMatchObject({
      id: 'c1',
      ownerId: 'u1',
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });
});
