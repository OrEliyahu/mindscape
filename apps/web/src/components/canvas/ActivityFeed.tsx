'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { AgentActivity } from '@/stores/canvas-store';
import type { AgentPersona, AgentSessionSummary } from '@/lib/agent-persona-client';

const DEFAULT_PERSONA: AgentPersona = {
  key: 'unknown',
  name: 'Agent',
  emoji: '🤖',
  color: '#64748b',
  description: '',
};

function formatEntry(entry: AgentActivity): string {
  switch (entry.type) {
    case 'status':
      return `Status: ${String(entry.data)}`;
    case 'thought':
      return String(entry.data);
    case 'tool-call': {
      const body = entry.data as { tool?: string };
      return `Tool: ${body.tool ?? 'invoke'}`;
    }
    case 'error':
      return `Error: ${String(entry.data)}`;
    default:
      return 'Event';
  }
}

export default function ActivityFeed({
  personas,
  sessions,
}: {
  personas: AgentPersona[];
  sessions: AgentSessionSummary[];
}) {
  const activity = useCanvasStore((s) => s.agentActivity);
  const [expanded, setExpanded] = useState(false);

  const personasByKey = useMemo(() => {
    const map = new Map<string, AgentPersona>();
    for (const persona of personas) {
      map.set(persona.key, persona);
    }
    return map;
  }, [personas]);

  const sessionsById = useMemo(() => {
    const map = new Map<string, AgentSessionSummary>();
    for (const session of sessions) {
      map.set(session.id, session);
    }
    return map;
  }, [sessions]);

  useEffect(() => {
    if (!expanded) return;
    const timeoutId = window.setTimeout(() => setExpanded(false), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [expanded, activity.length]);

  const recent = useMemo(() => activity.slice(-14).reverse(), [activity]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 12,
        maxWidth: 280,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 999,
          border: '1px solid rgba(148,163,184,0.35)',
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(8px)',
          padding: '0.35rem 0.62rem',
          fontSize: '0.72rem',
          color: '#0f172a',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: activity.length > 0 ? '#10b981' : '#94a3b8',
            display: 'inline-block',
          }}
        />
        {activity.length} event{activity.length !== 1 ? 's' : ''}
      </button>

      {expanded ? (
        <div
          style={{
            marginTop: 8,
            maxWidth: 280,
            maxHeight: 250,
            overflowY: 'auto',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.35)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 22px rgba(15,23,42,0.1)',
            padding: '0.45rem',
            display: 'grid',
            gap: 6,
          }}
        >
          {recent.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>No activity yet.</div>
          ) : (
            recent.map((entry) => {
              const session = sessionsById.get(entry.sessionId);
              const persona = personasByKey.get(session?.agentName ?? '') ?? DEFAULT_PERSONA;
              return (
                <div
                  key={`${entry.sessionId}:${entry.timestamp}`}
                  style={{
                    borderRadius: 8,
                    border: '1px solid rgba(226,232,240,0.9)',
                    background: '#fff',
                    padding: '0.38rem 0.45rem',
                    fontSize: '0.7rem',
                    color: '#0f172a',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <span style={{ color: persona.color }}>{persona.emoji} {persona.name}</span>
                    <span style={{ color: '#64748b' }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>{formatEntry(entry)}</div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
