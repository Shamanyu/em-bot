import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Engineering Progress Dashboard',
  description: 'Daily snapshot of team progress, goals, and weekly updates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
