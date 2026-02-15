import { clearSession, loadSession, saveSession, type AuthSession } from './auth-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

interface Credentials {
  email: string;
  password: string;
}

interface SignupPayload extends Credentials {
  name: string;
}

async function postAuth(path: string, payload: object): Promise<AuthSession> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Authentication failed');
    throw new Error(text || 'Authentication failed');
  }

  const body = await res.json() as AuthResponse;
  const session: AuthSession = {
    user: body.user,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };

  saveSession(session);
  return session;
}

export function signup(payload: SignupPayload): Promise<AuthSession> {
  return postAuth('/auth/signup', payload);
}

export function login(payload: Credentials): Promise<AuthSession> {
  return postAuth('/auth/login', payload);
}

export async function refreshSession(): Promise<AuthSession | null> {
  const current = loadSession();
  if (!current?.refreshToken) return null;

  try {
    return await postAuth('/auth/refresh', { refreshToken: current.refreshToken });
  } catch {
    clearSession();
    return null;
  }
}

export async function fetchMe(): Promise<AuthSession | null> {
  const current = loadSession();
  if (!current?.accessToken) return null;

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${current.accessToken}` },
    cache: 'no-store',
  });

  if (res.ok) {
    const user = await res.json() as AuthSession['user'];
    const next = { ...current, user };
    saveSession(next);
    return next;
  }

  if (res.status === 401) {
    return refreshSession();
  }

  return current;
}
