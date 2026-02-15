import { NotFoundException } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { PG_POOL } from '../database/database.provider';

describe('CanvasService', () => {
  const query = jest.fn();
  const service = new CanvasService({ query } as any);

  beforeEach(() => {
    query.mockReset();
  });

  it('creates canvas with defaults', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Untitled Canvas' }] });

    const result = await service.create();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO canvases'),
      ['Untitled Canvas', null],
    );
    expect(result.id).toBe('c1');
  });

  it('throws on update when canvas does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(service.update('missing', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps canvas list payload', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'c1',
        title: 'A',
        owner_id: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        settings: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
    });

    const result = await service.findAll();

    expect(result[0]).toMatchObject({ id: 'c1', title: 'A' });
  });
});
