/**
 * Frontend API client.
 *
 * Viewers are **read-only** — they only fetch data.
 * All mutations (canvas writes, agent invocations) happen on the backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/* ── Canvas (read-only) ───────────────────────── */

export function getCanvases() {
  return get<{ id: string; title: string; createdAt: string; updatedAt: string }[]>(
    `/canvases`,
  );
}

export function getCanvas(id: string) {
  return get<{ id: string; title: string; nodes: unknown[]; edges: unknown[] }>(
    `/canvases/${id}`,
  );
}

/* ── Agent sessions (read-only) ───────────────── */

export function getAgentSessions(canvasId: string) {
  return get<unknown[]>(`/canvases/${canvasId}/agent/sessions`);
}
