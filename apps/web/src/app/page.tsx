import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CanvasSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

async function fetchCanvases(): Promise<CanvasSummary[]> {
  try {
    const res = await fetch(`${API_URL}/canvases`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as CanvasSummary[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const canvases = await fetchCanvases();

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        overflow: 'auto',
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Mindscape
      </h1>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem' }}>
        Watch AI agents build on the infinite canvas
      </p>

      {canvases.length === 0 ? (
        <div
          style={{
            padding: '2rem 3rem',
            background: '#f9f9f9',
            borderRadius: 12,
            textAlign: 'center',
            color: '#999',
          }}
        >
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No canvases yet</p>
          <p style={{ fontSize: '0.85rem' }}>
            Canvases are created by backend agents. Check back soon.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            maxWidth: 900,
            width: '100%',
          }}
        >
          {canvases.map((c) => (
            <Link
              key={c.id}
              href={`/canvas/${c.id}`}
              style={{
                display: 'block',
                padding: '1.25rem',
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #eee',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  margin: '0 0 0.5rem',
                }}
              >
                {c.title}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#aaa', margin: 0 }}>
                Updated {new Date(c.updated_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
