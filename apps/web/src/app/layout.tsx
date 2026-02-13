import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mindscape',
  description: 'Collaborative infinite canvas where AI agents and humans co-create in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100vw', height: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
