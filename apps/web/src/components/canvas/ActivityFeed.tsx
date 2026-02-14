'use client';

import { useCanvasStore } from '@/stores/canvas-store';
import type { AgentActivity } from '@/stores/canvas-store';

/* ─── Single activity entry ───────────────────── */
function ActivityEntry({ entry }: { entry: AgentActivity }) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  switch (entry.type) {
    case 'status': {
      const status = entry.data as string;
      const statusColors: Record<string, string> = {
        thinking: '#3B82F6',
        acting: '#F59E0B',
        idle: '#10B981',
        error: '#EF4444',
      };
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColors[status] ?? '#999',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{time}</span>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>
            Agent {status}
          </span>
        </div>
      );
    }

    case 'thought':
      return (
        <div style={{ padding: '4px 0' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{time}</span>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#333',
              background: '#f0f4ff',
              borderRadius: 6,
              padding: '6px 10px',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {entry.data as string}
          </div>
        </div>
      );

    case 'tool-call': {
      const tc = entry.data as { tool: string; args: unknown };
      return (
        <div style={{ padding: '4px 0' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{time}</span>
          <div
            style={{
              fontSize: '0.78rem',
              color: '#555',
              background: '#fef9ee',
              borderRadius: 6,
              padding: '6px 10px',
              marginTop: 2,
              fontFamily: 'monospace',
            }}
          >
            <strong>{tc.tool}</strong>
            <span style={{ color: '#aaa', marginLeft: 6 }}>
              {JSON.stringify(tc.args).slice(0, 120)}
            </span>
          </div>
        </div>
      );
    }

    case 'error':
      return (
        <div style={{ padding: '4px 0' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>{time}</span>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#DC2626',
              background: '#FEF2F2',
              borderRadius: 6,
              padding: '6px 10px',
              marginTop: 2,
            }}
          >
            {entry.data as string}
          </div>
        </div>
      );

    default:
      return null;
  }
}

/* ─── Activity feed panel ─────────────────────── */
export default function ActivityFeed() {
  const activity = useCanvasStore((s) => s.agentActivity);

  if (activity.length === 0) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 10,
          width: 320,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          padding: '12px 16px',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
          Agent Activity
        </div>
        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
          No activity yet. Waiting for agents...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
        width: 320,
        maxHeight: 360,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 16px 6px',
          fontSize: '0.85rem',
          fontWeight: 600,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        Agent Activity
        <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: '0.75rem' }}>
          {activity.length} events
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 16px 12px',
        }}
      >
        {activity.map((entry, i) => (
          <ActivityEntry key={`${entry.sessionId}-${entry.timestamp}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
