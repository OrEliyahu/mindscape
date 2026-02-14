import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side route that creates a new canvas and redirects to it.
 * This is the only "write" the frontend makes — creating an empty
 * canvas container. All content mutations come from backend agents.
 */
export async function GET() {
  const res = await fetch(`${API_URL}/canvases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Untitled Canvas' }),
  });

  if (!res.ok) {
    return new Response('Failed to create canvas', { status: 500 });
  }

  const canvas = (await res.json()) as { id: string };
  redirect(`/canvas/${canvas.id}`);
}
