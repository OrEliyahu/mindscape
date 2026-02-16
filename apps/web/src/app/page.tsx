'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CanvasSummary {
  id: string;
  title: string;
}

interface CanvasMeta {
  activeAgents: number;
}

interface AgentSessionLike {
  status?: string;
}

function normalizeCanvas(raw: Record<string, unknown>): CanvasSummary {
  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Untitled Canvas'),
  };
}

function getActiveAgentCount(sessions: AgentSessionLike[]): number {
  return sessions.filter((session) => session.status === 'acting' || session.status === 'thinking').length;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function HomePage() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [metaByCanvas, setMetaByCanvas] = useState<Record<string, CanvasMeta>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const rawCanvases = await fetchJson<Record<string, unknown>[]>('/canvases');
        if (cancelled) return;
        const normalized = rawCanvases.map(normalizeCanvas);
        setCanvases(normalized);

        if (normalized.length === 1) {
          router.replace(`/canvas/${normalized[0].id}`);
          return;
        }

        const results = await Promise.all(
          normalized.map(async (canvas) => {
            try {
              const sessions = await fetchJson<AgentSessionLike[]>(`/canvases/${canvas.id}/agent/sessions`);
              return [canvas.id, { activeAgents: getActiveAgentCount(sessions) }] as const;
            } catch {
              return [canvas.id, { activeAgents: 0 }] as const;
            }
          }),
        );

        if (!cancelled) {
          setMetaByCanvas(Object.fromEntries(results));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [router]);

  const liveCount = useMemo(
    () => Object.values(metaByCanvas).filter((meta) => meta.activeAgents > 0).length,
    [metaByCanvas],
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '2.2rem 1.2rem 2.8rem',
        boxSizing: 'border-box',
        color: '#0f172a',
        background:
          'radial-gradient(circle at 12% 18%, #d0ebff 0%, transparent 34%), radial-gradient(circle at 88% 10%, #d3f9d8 0%, transparent 28%), linear-gradient(165deg, #f8fafc 0%, #ecfdf5 100%)',
        fontFamily: '"Avenir Next", "SF Pro Display", "Segoe UI", sans-serif',
      }}
    >
      <style jsx>{`
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.25); }
          50% { box-shadow: 0 0 0 16px rgba(34, 197, 94, 0.06); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.25); }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ marginBottom: '1.8rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 6vw, 3.3rem)', lineHeight: 1.05 }}>Mindscape</h1>
          <p style={{ margin: '0.52rem 0 0', fontSize: '0.95rem', color: '#475569' }}>
            {liveCount} live canvas{liveCount !== 1 ? 'es' : ''}
          </p>
        </header>

        {loading ? (
          <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading gallery...</div>
        ) : null}

        {!loading && canvases.length === 0 ? (
          <div
            style={{
              borderRadius: 18,
              border: '1px dashed rgba(100, 116, 139, 0.55)',
              background: 'rgba(255,255,255,0.68)',
              padding: '2.2rem',
              fontSize: '1rem',
              color: '#334155',
            }}
          >
            No canvases yet.
          </div>
        ) : null}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {canvases.map((canvas) => {
            const meta = metaByCanvas[canvas.id] ?? { activeAgents: 0 };
            const isLive = meta.activeAgents > 0;
            return (
              <Link
                key={canvas.id}
                href={`/canvas/${canvas.id}`}
                style={{
                  minHeight: 300,
                  borderRadius: 22,
                  padding: '1.05rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: isLive ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(148,163,184,0.25)',
                  background:
                    'linear-gradient(150deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.78) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  animation: isLive ? 'livePulse 2s ease-in-out infinite' : 'none',
                  transition: 'transform 180ms ease, box-shadow 180ms ease',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: isLive ? '#166534' : '#64748b', letterSpacing: 0.3 }}>
                  {isLive ? 'LIVE' : 'IDLE'}
                </div>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
                      lineHeight: 1.12,
                      wordBreak: 'break-word',
                    }}
                  >
                    {canvas.title}
                  </h2>
                  <p style={{ margin: '0.58rem 0 0', color: '#334155', fontSize: '0.9rem' }}>
                    {isLive ? `${meta.activeAgents} agents working` : 'Idle'}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
