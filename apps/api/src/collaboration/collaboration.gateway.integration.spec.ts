import { CollaborationGateway } from './collaboration.gateway';

describe('CollaborationGateway integration', () => {
  const canvasService = { findOneWithNodes: jest.fn() };
  const nodesService = { findInViewport: jest.fn() };
  const edgesService = { findByCanvas: jest.fn() };
  const presenceService = {
    addViewer: jest.fn(),
    removeViewer: jest.fn(),
    getCanvasIdForSocket: jest.fn(),
  };
  const agentBroadcast = { setServer: jest.fn() };

  let gateway: CollaborationGateway;
  let roomEmit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new CollaborationGateway(
      canvasService as any,
      nodesService as any,
      edgesService as any,
      presenceService as any,
      agentBroadcast as any,
    );

    roomEmit = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: roomEmit }),
    } as any;
  });

  it('sends viewport-filtered state on join', async () => {
    const client = {
      id: 'socket-1',
      handshake: { auth: {} },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as any;

    presenceService.addViewer.mockReturnValue([]);
    nodesService.findInViewport.mockResolvedValue([
      {
        id: 'n1',
        canvas_id: 'c1',
        type: 'sticky_note',
        position_x: 0,
        position_y: 0,
        width: 100,
        height: 100,
        z_index: 0,
        content: {},
        style: {},
        created_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    edgesService.findByCanvas.mockResolvedValue([]);

    await gateway.handleJoinCanvas(client, {
      canvasId: 'c1',
      viewport: { x: 0, y: 0, w: 100, h: 100, zoom: 1 },
    });

    expect(nodesService.findInViewport).toHaveBeenCalledWith('c1', 0, 0, 100, 100);
    expect(client.emit).toHaveBeenCalledWith('canvas:state', expect.objectContaining({ nodes: expect.any(Array) }));
  });

  it('processes viewport updates for connected socket', async () => {
    const client = { id: 'socket-1', emit: jest.fn() } as any;

    presenceService.getCanvasIdForSocket.mockReturnValue('c1');
    nodesService.findInViewport.mockResolvedValue([]);
    edgesService.findByCanvas.mockResolvedValue([]);

    await gateway.handleViewportUpdate(client, { x: 1, y: 2, w: 3, h: 4, zoom: 1 });

    expect(nodesService.findInViewport).toHaveBeenCalledWith('c1', 1, 2, 3, 4);
    expect(client.emit).toHaveBeenCalledWith('canvas:state', { nodes: [], edges: [] });
  });
});
