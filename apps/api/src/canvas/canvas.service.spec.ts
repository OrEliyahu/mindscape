import { CanvasService } from './canvas.service';
import { NotFoundException } from '@nestjs/common';

function createMockPool(queryResults: Record<string, { rows: unknown[]; rowCount?: number }>) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      for (const [key, result] of Object.entries(queryResults)) {
        if (sql.includes(key)) return Promise.resolve(result);
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
  };
}

describe('CanvasService', () => {
  describe('findAll', () => {
    it('returns mapped canvas payloads', async () => {
      const mockPool = createMockPool({
        'SELECT id': {
          rows: [
            { id: 'c1', title: 'Canvas 1', owner_id: null, created_at: 'ts1', updated_at: 'ts2' },
          ],
        },
      });
      const service = new CanvasService(mockPool as any);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
      expect(result[0].title).toBe('Canvas 1');
      expect(result[0].ownerId).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts a canvas and returns the row', async () => {
      const mockPool = createMockPool({
        INSERT: { rows: [{ id: 'c1', title: 'New Canvas' }] },
      });
      const service = new CanvasService(mockPool as any);
      const result = await service.create('New Canvas');
      expect(result.id).toBe('c1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        ['New Canvas', null],
      );
    });

    it('uses default title when none provided', async () => {
      const mockPool = createMockPool({
        INSERT: { rows: [{ id: 'c1', title: 'Untitled Canvas' }] },
      });
      const service = new CanvasService(mockPool as any);
      await service.create();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        ['Untitled Canvas', null],
      );
    });
  });

  describe('findOneWithNodes', () => {
    it('returns canvas with nodes and edges', async () => {
      const mockPool = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{ id: 'c1', title: 'Test', owner_id: null, viewport: {}, settings: {}, created_at: 'ts', updated_at: 'ts' }],
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'n1', canvas_id: 'c1', type: 'sticky_note',
              position_x: 0, position_y: 0, width: 200, height: 200,
              rotation: 0, z_index: 0, content: {}, style: {},
              locked: false, created_by: null, created_at: 'ts', updated_at: 'ts',
            }],
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'e1', canvas_id: 'c1', source_id: 'n1', target_id: 'n2',
              label: null, style: {}, created_at: 'ts',
            }],
          }),
      };
      const service = new CanvasService(mockPool as any);
      const result = await service.findOneWithNodes('c1');
      expect(result.id).toBe('c1');
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect((result.nodes[0] as any).positionX).toBe(0);
      expect((result.edges[0] as any).sourceId).toBe('n1');
    });

    it('throws NotFoundException when canvas does not exist', async () => {
      const mockPool = createMockPool({ SELECT: { rows: [] } });
      const service = new CanvasService(mockPool as any);
      await expect(service.findOneWithNodes('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes canvas by id', async () => {
      const mockPool = createMockPool({ DELETE: { rows: [], rowCount: 1 } });
      const service = new CanvasService(mockPool as any);
      const result = await service.remove('c1');
      expect(result.deleted).toBe(true);
    });

    it('throws NotFoundException when canvas does not exist', async () => {
      const mockPool = createMockPool({ DELETE: { rows: [], rowCount: 0 } });
      const service = new CanvasService(mockPool as any);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
