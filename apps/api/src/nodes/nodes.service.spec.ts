import { NotFoundException } from '@nestjs/common';
import { NodesService } from './nodes.service';

describe('NodesService', () => {
  const query = jest.fn();
  const connect = jest.fn();
  const service = new NodesService({ query, connect } as any);

  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it('creates node with defaults', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });

    const result = await service.create('c1', { type: 'sticky_note' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nodes'),
      ['c1', 'sticky_note', 0, 0, 200, 200, JSON.stringify({}), JSON.stringify({}), null],
    );
    expect(result.id).toBe('n1');
  });

  it('throws when deleting a missing node', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds viewport query', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await service.findInViewport('c1', 1, 2, 3, 4);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND position_x + width >= $2'),
      ['c1', 1, 2, 3, 4],
    );
  });
});
