import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunnerService } from './agent-runner.service';

describe('AgentRunnerService integration', () => {
  const nodesService = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const edgesService = { create: jest.fn(), remove: jest.fn() };
  const canvasService = { findOneWithNodes: jest.fn(), createSnapshot: jest.fn() };
  const broadcast = {
    broadcastAgentStatus: jest.fn(),
    broadcastAgentError: jest.fn(),
    broadcastAgentThought: jest.fn(),
    broadcastAgentToolCall: jest.fn(),
    broadcastAgentCursor: jest.fn(),
    broadcastNodeCreated: jest.fn(),
    broadcastNodeUpdated: jest.fn(),
    broadcastNodeDeleted: jest.fn(),
    broadcastEdgeCreated: jest.fn(),
    broadcastEdgeDeleted: jest.fn(),
    broadcastAgentCollaboration: jest.fn(),
  };
  const sessions = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    appendToolCall: jest.fn(),
  };
  const sharedContext = {
    getRecentEntries: jest.fn().mockResolvedValue([]),
    getOpenRequests: jest.fn().mockResolvedValue([]),
    addEntry: jest.fn(),
  };

  let service: AgentRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();

    const config = {
      get: jest.fn((key: string, fallback: string) => fallback),
    } as unknown as ConfigService;

    service = new AgentRunnerService(
      config,
      nodesService as any,
      edgesService as any,
      canvasService as any,
      broadcast as any,
      sessions as any,
      sharedContext as any,
    );

    (service as any).runAgentLoop = jest.fn().mockResolvedValue(undefined);
    sessions.create.mockResolvedValue({ id: 's1' });
  });

  it('sanitizes prompt before starting run loop', async () => {
    await service.invoke('canvas-1', {
      prompt: ' hello\n\nworld\u0000 ',
      model: 'm',
    });

    expect((service as any).runAgentLoop).toHaveBeenCalledWith(
      'canvas-1',
      's1',
      'm',
      expect.any(String),
      expect.objectContaining({ prompt: 'hello world' }),
    );
  });

  it('rejects empty prompts after sanitization', async () => {
    await expect(service.invoke('canvas-1', { prompt: '   \n\t', model: 'm' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces concurrent session cap', async () => {
    (service as any).activeSessions.set('canvas-1', new Set(['a', 'b', 'c']));
    await expect(service.invoke('canvas-1', { prompt: 'build', model: 'm' })).rejects.toThrow(/max 3/);
  });
});
