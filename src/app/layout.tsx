import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Live Tracking Kereta Api & Pantau Touring',
  description: 'Sistem Pemantauan Kereta Api GAPEKA 2025 & GPS Real-time Touring',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
