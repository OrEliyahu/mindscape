import type { AgentStatus } from '@mindscape/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AgentPersona {
  key: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

export interface AgentSessionSummary {
  id: string;
  agentName: string;
  status: AgentStatus;
  updatedAt: string;
}

function normalizePersona(raw: Record<string, unknown>): AgentPersona {
  return {
    key: String(raw.key ?? raw.agentType ?? raw.agent_type ?? 'unknown'),
    name: String(raw.name ?? 'Agent'),
    emoji: String(raw.emoji ?? '🤖'),
    color: String(raw.color ?? '#6366f1'),
    description: String(raw.description ?? ''),
  };
}

function normalizeSession(raw: Record<string, unknown>): AgentSessionSummary {
  const status = String(raw.status ?? 'idle') as AgentStatus;
  return {
    id: String(raw.id),
    agentName: String(raw.agentName ?? raw.agent_name ?? 'unknown'),
    status,
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getAgentPersonas(canvasId: string): Promise<AgentPersona[]> {
  const body = await fetchJson<Record<string, unknown>[]>(`/canvases/${canvasId}/agent/personas`);
  return body.map(normalizePersona);
}

export async function getAgentSessions(canvasId: string): Promise<AgentSessionSummary[]> {
  const body = await fetchJson<Record<string, unknown>[]>(`/canvases/${canvasId}/agent/sessions`);
  return body.map(normalizeSession);
}
