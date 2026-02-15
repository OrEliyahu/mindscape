'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, signup } from '@/lib/auth-api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (mode === 'login' ? 'Sign in' : 'Create account'), [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await signup({ name, email, password });
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 'min(420px, calc(100% - 2rem))',
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          borderRadius: 14,
          padding: '1.25rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h1>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        </label>

        {mode === 'signup' ? (
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#334155' }}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </label>
        ) : null}

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} type="password" />
        </label>

        {error ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

        <button disabled={loading} type="submit" style={{ padding: '0.55rem 0.75rem' }}>
          {loading ? 'Working...' : title}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'));
            setError(null);
          }}
          style={{ padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #cbd5e1' }}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
