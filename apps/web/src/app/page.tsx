import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Mindscape</h1>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem' }}>
        Collaborative infinite canvas for AI agents and humans
      </p>
      <Link
        href="/canvas/new"
        style={{
          padding: '12px 32px',
          backgroundColor: '#000',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '1rem',
          fontWeight: 500,
        }}
      >
        Create Canvas
      </Link>
    </main>
  );
}
