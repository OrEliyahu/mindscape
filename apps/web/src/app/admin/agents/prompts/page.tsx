'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'mindscape_admin_password';

interface PersonaPromptConfig {
  key: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  systemPromptSuffix: string;
  schedulerPrompts: string[];
  overridden: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface PromptConfigResponse {
  baseInstructions: string;
  baseUpdatedAt: string | null;
  baseUpdatedBy: string | null;
  personas: PersonaPromptConfig[];
}

async function adminFetch<T>(path: string, password: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': password,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Request failed');
    throw new Error(text || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export default function AdminAgentPromptsPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PromptConfigResponse | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [baseDraft, setBaseDraft] = useState('');
  const [suffixDraft, setSuffixDraft] = useState('');
  const [schedulerDraft, setSchedulerDraft] = useState('');
  const [updatedBy, setUpdatedBy] = useState('admin-ui');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPassword(saved);
      void authenticate(saved);
    }
  }, []);

  const selected = useMemo(
    () => config?.personas.find((persona) => persona.key === selectedPersona) ?? null,
    [config, selectedPersona],
  );

  useEffect(() => {
    if (!config) return;
    setBaseDraft(config.baseInstructions);
    if (!selectedPersona && config.personas.length > 0) {
      setSelectedPersona(config.personas[0].key);
    }
  }, [config, selectedPersona]);

  useEffect(() => {
    if (!selected) return;
    setSuffixDraft(selected.systemPromptSuffix);
    setSchedulerDraft(selected.schedulerPrompts.join('\n'));
  }, [selected]);

  const authenticate = async (candidatePassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await adminFetch<PromptConfigResponse>('/admin/agent-prompts', candidatePassword);
      setConfig(next);
      setAuthenticated(true);
      window.sessionStorage.setItem(STORAGE_KEY, candidatePassword);
    } catch (err) {
      setAuthenticated(false);
      window.sessionStorage.removeItem(STORAGE_KEY);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const onPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await authenticate(password);
  };

  const saveBase = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminFetch('/admin/agent-prompts/base', password, {
        method: 'PATCH',
        body: JSON.stringify({ baseInstructions: baseDraft, updatedBy }),
      });
      await authenticate(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save base prompt');
    } finally {
      setSaving(false);
    }
  };

  const resetBase = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminFetch('/admin/agent-prompts/base', password, { method: 'DELETE' });
      await authenticate(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset base prompt');
    } finally {
      setSaving(false);
    }
  };

  const savePersona = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const schedulerPrompts = schedulerDraft
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      await adminFetch(`/admin/agent-prompts/personas/${selected.key}`, password, {
        method: 'PATCH',
        body: JSON.stringify({
          systemPromptSuffix: suffixDraft,
          schedulerPrompts,
          updatedBy,
        }),
      });
      await authenticate(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save persona prompt');
    } finally {
      setSaving(false);
    }
  };

  const resetPersona = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/admin/agent-prompts/personas/${selected.key}`, password, { method: 'DELETE' });
      await authenticate(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset persona prompt');
    } finally {
      setSaving(false);
    }
  };

  if (!authenticated) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a' }}>
        <form
          onSubmit={onPasswordSubmit}
          style={{
            width: 'min(92vw, 440px)',
            background: '#111827',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 18,
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: 20 }}>Agent Prompt Admin</h1>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Enter admin password to unlock prompt controls.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #334155', marginBottom: 12 }}
            placeholder="Admin password"
          />
          <button
            type="submit"
            disabled={loading || password.length === 0}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: 0, background: '#38bdf8', color: '#082f49' }}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
          {error ? <p style={{ color: '#fca5a5', fontSize: 12 }}>{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: 20, background: '#f8fafc', color: '#0f172a' }}>
      <h1 style={{ marginTop: 0 }}>Admin: Agent Prompts</h1>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <section style={{ marginBottom: 20 }}>
        <h2>Base Instructions</h2>
        <textarea
          value={baseDraft}
          onChange={(e) => setBaseDraft(e.target.value)}
          style={{ width: '100%', minHeight: 220, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <input
            value={updatedBy}
            onChange={(e) => setUpdatedBy(e.target.value)}
            placeholder="updated by"
            style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
          <button onClick={saveBase} disabled={saving}>Save Base</button>
          <button onClick={resetBase} disabled={saving}>Reset Base</button>
        </div>
      </section>

      <section>
        <h2>Persona Prompt Overrides</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 8, background: '#fff' }}>
            {config?.personas.map((persona) => (
              <button
                key={persona.key}
                onClick={() => setSelectedPersona(persona.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 8,
                  marginBottom: 6,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: selectedPersona === persona.key ? '#e0f2fe' : '#fff',
                }}
              >
                {persona.emoji} {persona.name} {persona.overridden ? '• overridden' : ''}
              </button>
            ))}
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, background: '#fff' }}>
            {selected ? (
              <>
                <h3 style={{ marginTop: 0 }}>{selected.emoji} {selected.name}</h3>
                <label>System Prompt Suffix</label>
                <textarea
                  value={suffixDraft}
                  onChange={(e) => setSuffixDraft(e.target.value)}
                  style={{ width: '100%', minHeight: 200, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <label style={{ display: 'block', marginTop: 10 }}>Scheduler Prompts (one per line)</label>
                <textarea
                  value={schedulerDraft}
                  onChange={(e) => setSchedulerDraft(e.target.value)}
                  style={{ width: '100%', minHeight: 140, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button onClick={savePersona} disabled={saving}>Save Persona</button>
                  <button onClick={resetPersona} disabled={saving}>Reset Persona</button>
                </div>
              </>
            ) : (
              <p>Select a persona.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
