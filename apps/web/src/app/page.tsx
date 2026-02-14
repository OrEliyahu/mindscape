'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CanvasSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

type SessionStatus = 'idle' | 'thinking' | 'acting' | 'error';
type LiveStatus = 'live' | 'idle' | 'error' | 'waiting';

interface CanvasLiveMeta {
  status: LiveStatus;
  activeAgents: number;
  lastEventAt: number | null;
}

interface AgentSessionLike {
  id?: string;
  status?: SessionStatus;
  updatedAt?: string;
  updated_at?: string;
}

const statusStyles: Record<LiveStatus, { label: string; bg: string; fg: string }> = {
  live: { label: 'Live', bg: '#dcfce7', fg: '#166534' },
  idle: { label: 'Idle', bg: '#e5e7eb', fg: '#374151' },
  waiting: { label: 'Waiting', bg: '#e0f2fe', fg: '#0c4a6e' },
  error: { label: 'Error', bg: '#fee2e2', fg: '#991b1b' },
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function formatRelative(ts: number | null, now: number) {
  if (!ts) return 'No events yet';
  const diffMs = ts - now;
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 5) return 'just now';
  if (absSec < 60) return `${absSec}s ago`;

  const absMin = Math.round(absSec / 60);
  if (absMin < 60) return `${absMin}m ago`;

  const absHour = Math.round(absMin / 60);
  if (absHour < 24) return `${absHour}h ago`;

  return new Date(ts).toLocaleString();
}

function normalizeCanvas(raw: Record<string, unknown>): CanvasSummary {
  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Untitled canvas'),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

function deriveLiveMeta(sessions: AgentSessionLike[]): CanvasLiveMeta {
  if (sessions.length === 0) {
    return { status: 'waiting', activeAgents: 0, lastEventAt: null };
  }

  let hasError = false;
  let activeAgents = 0;
  let lastEventAt: number | null = null;

  for (const session of sessions) {
    const status = session.status;
    if (status === 'error') hasError = true;
    if (status === 'acting' || status === 'thinking') activeAgents += 1;

    const stamp = session.updatedAt ?? session.updated_at;
    if (!stamp) continue;
    const time = new Date(stamp).getTime();
    if (!Number.isNaN(time)) {
      lastEventAt = lastEventAt ? Math.max(lastEventAt, time) : time;
    }
  }

  if (hasError) return { status: 'error', activeAgents, lastEventAt };
  if (activeAgents > 0) return { status: 'live', activeAgents, lastEventAt };
  return { status: 'idle', activeAgents: 0, lastEventAt };
}

export default function HomePage() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [live, setLive] = useState<Record<string, CanvasLiveMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadCanvases = useCallback(async () => {
    try {
      const raw = await fetchJson<Record<string, unknown>[]>('/canvases');
      setCanvases(raw.map(normalizeCanvas));
      setError(null);
    } catch {
      setError('Could not reach API. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLiveStatus = useCallback(async (canvasIds: string[]) => {
    if (canvasIds.length === 0) {
      setLive({});
      return;
    }

    const entries = await Promise.all(
      canvasIds.map(async (id) => {
        try {
          const sessions = await fetchJson<AgentSessionLike[]>(`/canvases/${id}/agent/sessions`);
          return [id, deriveLiveMeta(sessions)] as const;
        } catch {
          return [id, { status: 'waiting', activeAgents: 0, lastEventAt: null } satisfies CanvasLiveMeta] as const;
        }
      }),
    );

    setLive(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    loadCanvases();
    const t = window.setInterval(loadCanvases, 20_000);
    return () => window.clearInterval(t);
  }, [loadCanvases]);

  useEffect(() => {
    loadLiveStatus(canvases.map((c) => c.id));
    const t = window.setInterval(() => {
      loadLiveStatus(canvases.map((c) => c.id));
    }, 5_000);
    return () => window.clearInterval(t);
  }, [canvases, loadLiveStatus]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const totalLive = useMemo(
    () => Object.values(live).filter((m) => m.status === 'live').length,
    [live],
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        padding: '3rem 1.25rem',
        color: '#0f172a',
        background:
          'radial-gradient(circle at 15% 15%, #e0f2fe 0%, #f8fafc 42%), radial-gradient(circle at 90% 8%, #ecfccb 0%, transparent 35%)',
        fontFamily: '"SF Pro Text", "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', margin: 0 }}>Mindscape</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#334155', maxWidth: 700 }}>
            A read-only live view of AI agents building collaborative canvases.
          </p>
          <div style={{ marginTop: '0.75rem', color: '#475569', fontSize: '0.9rem' }}>
            {canvases.length} canvases, {totalLive} live now
          </div>
        </header>

        {loading ? (
          <div style={{ color: '#64748b' }}>Loading canvases...</div>
        ) : null}

        {!loading && error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 14,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        ) : null}

        {!loading && canvases.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              borderRadius: 18,
              border: '1px dashed #94a3b8',
              background: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
              color: '#475569',
            }}
          >
            No canvases yet. When backend agents start creating content, it will appear here.
          </div>
        ) : null}

        <section
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {canvases.map((canvas) => {
            const meta = live[canvas.id] ?? { status: 'waiting', activeAgents: 0, lastEventAt: null };
            const style = statusStyles[meta.status];
            return (
              <Link
                key={canvas.id}
                href={`/canvas/${canvas.id}`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  borderRadius: 16,
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.3 }}>{canvas.title}</h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.45rem',
                      borderRadius: 999,
                      background: style.bg,
                      color: style.fg,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#475569' }}>
                  Updated {formatRelative(new Date(canvas.updatedAt).getTime(), now)}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  Last agent event: {formatRelative(meta.lastEventAt, now)}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  {meta.activeAgents} active agent{meta.activeAgents !== 1 ? 's' : ''}
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
