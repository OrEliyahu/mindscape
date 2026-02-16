import { toNodePayload, toEdgePayload, toCanvasPayload } from './mappers';

describe('toNodePayload', () => {
  const dbRow = {
    id: 'n1',
    canvas_id: 'c1',
    type: 'sticky_note',
    position_x: 100,
    position_y: 200,
    width: 250,
    height: 150,
    rotation: 45,
    z_index: 3,
    content: { text: 'Hello' },
    style: { backgroundColor: '#fff' },
    locked: true,
    created_by: 'u1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  it('maps snake_case DB row to camelCase NodePayload', () => {
    const result = toNodePayload(dbRow);
    expect(result).toEqual({
      id: 'n1',
      canvasId: 'c1',
      type: 'sticky_note',
      positionX: 100,
      positionY: 200,
      width: 250,
      height: 150,
      rotation: 45,
      zIndex: 3,
      content: { text: 'Hello' },
      style: { backgroundColor: '#fff' },
      locked: true,
      createdBy: 'u1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    });
  });

  it('defaults rotation to 0 when null', () => {
    const result = toNodePayload({ ...dbRow, rotation: null });
    expect(result.rotation).toBe(0);
  });

  it('defaults locked to false when null', () => {
    const result = toNodePayload({ ...dbRow, locked: null });
    expect(result.locked).toBe(false);
  });

  it('defaults createdBy to null when null', () => {
    const result = toNodePayload({ ...dbRow, created_by: null });
    expect(result.createdBy).toBeNull();
  });
});

describe('toEdgePayload', () => {
  const dbRow = {
    id: 'e1',
    canvas_id: 'c1',
    source_id: 'n1',
    target_id: 'n2',
    label: 'depends on',
    style: { color: '#red' },
    created_at: '2024-01-01T00:00:00Z',
  };

  it('maps snake_case DB row to camelCase EdgePayload', () => {
    const result = toEdgePayload(dbRow);
    expect(result).toEqual({
      id: 'e1',
      canvasId: 'c1',
      sourceId: 'n1',
      targetId: 'n2',
      label: 'depends on',
      style: { color: '#red' },
      createdAt: '2024-01-01T00:00:00Z',
    });
  });

  it('defaults label to null when null', () => {
    const result = toEdgePayload({ ...dbRow, label: null });
    expect(result.label).toBeNull();
  });

  it('defaults style to empty object when null', () => {
    const result = toEdgePayload({ ...dbRow, style: null });
    expect(result.style).toEqual({});
  });
});

describe('toCanvasPayload', () => {
  const dbRow = {
    id: 'c1',
    title: 'Test Canvas',
    owner_id: 'u1',
    viewport: { x: 10, y: 20, zoom: 1.5 },
    settings: { theme: 'dark' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  it('maps snake_case DB row to camelCase canvas payload', () => {
    const result = toCanvasPayload(dbRow);
    expect(result).toEqual({
      id: 'c1',
      title: 'Test Canvas',
      ownerId: 'u1',
      viewport: { x: 10, y: 20, zoom: 1.5 },
      settings: { theme: 'dark' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    });
  });

  it('defaults ownerId to null when null', () => {
    const result = toCanvasPayload({ ...dbRow, owner_id: null });
    expect(result.ownerId).toBeNull();
  });
});
