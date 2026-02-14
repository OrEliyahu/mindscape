'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { AgentActivity } from '@/stores/canvas-store';

type ActivityFilter = 'all' | AgentActivity['type'];

function formatEntryBody(entry: AgentActivity) {
  switch (entry.type) {
    case 'status':
      return `Agent ${String(entry.data)}`;
    case 'thought':
      return String(entry.data);
    case 'tool-call': {
      const tc = entry.data as { tool?: string; args?: unknown };
      const args = JSON.stringify(tc.args ?? {});
      return `${tc.tool ?? 'tool'} ${args.length > 80 ? `${args.slice(0, 80)}...` : args}`;
    }
    case 'error':
      return String(entry.data);
    default:
      return '';
  }
}

function typeColor(type: AgentActivity['type']) {
  switch (type) {
    case 'status':
      return { bg: '#e0f2fe', fg: '#075985', label: 'Status' };
    case 'thought':
      return { bg: '#ede9fe', fg: '#5b21b6', label: 'Thought' };
    case 'tool-call':
      return { bg: '#fef3c7', fg: '#92400e', label: 'Tool' };
    case 'error':
      return { bg: '#fee2e2', fg: '#991b1b', label: 'Error' };
    default:
      return { bg: '#e5e7eb', fg: '#374151', label: 'Event' };
  }
}

/* ─── Single activity entry ───────────────────── */
function ActivityEntry({ entry }: { entry: AgentActivity }) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const color = typeColor(entry.type);
  const body = formatEntryBody(entry);

  return (
    <div style={{ padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{time}</span>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            padding: '0.15rem 0.4rem',
            borderRadius: 999,
            background: color.bg,
            color: color.fg,
          }}
        >
          {color.label}
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: '0.78rem',
          lineHeight: 1.35,
          color: entry.type === 'error' ? '#991b1b' : '#0f172a',
          fontFamily: entry.type === 'tool-call' ? 'monospace' : 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body}
      </div>
    </div>
  );
}

/* ─── Activity feed panel ─────────────────────── */
export default function ActivityFeed() {
  const activity = useCanvasStore((s) => s.agentActivity);
  const clearAgentActivity = useCanvasStore((s) => s.clearAgentActivity);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return activity;
    return activity.filter((entry) => entry.type === filter);
  }, [activity, filter]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || collapsed) return;
    const closeToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (closeToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filtered, collapsed]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
        width: 320,
        maxHeight: collapsed ? 'auto' : 420,
        background: 'rgba(255,255,255,0.94)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
        fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 12px 8px',
          fontSize: '0.85rem',
          fontWeight: 600,
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          Agent Activity
          <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 6, fontSize: '0.75rem' }}>
            {activity.length} events
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            cursor: 'pointer',
            border: '1px solid #cbd5e1',
            background: '#fff',
            borderRadius: 8,
            padding: '0.2rem 0.45rem',
            fontSize: '0.72rem',
            color: '#334155',
          }}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 12px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            {(['all', 'status', 'thought', 'tool-call', 'error'] as ActivityFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  cursor: 'pointer',
                  border: filter === value ? '1px solid #0ea5e9' : '1px solid #cbd5e1',
                  background: filter === value ? '#e0f2fe' : '#fff',
                  color: filter === value ? '#0c4a6e' : '#475569',
                  borderRadius: 999,
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.45rem',
                }}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAgentActivity}
              style={{
                marginLeft: 'auto',
                cursor: 'pointer',
                border: '1px solid #fecaca',
                background: '#fff',
                color: '#991b1b',
                borderRadius: 999,
                fontSize: '0.7rem',
                padding: '0.2rem 0.45rem',
              }}
            >
              Clear
            </button>
          </div>
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 12px 10px',
              minHeight: 100,
              maxHeight: 280,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#64748b', paddingTop: 8 }}>
                No activity yet. Waiting for agents...
              </div>
            ) : (
              filtered.map((entry, i) => (
                <ActivityEntry key={`${entry.sessionId}-${entry.timestamp}-${i}`} entry={entry} />
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
