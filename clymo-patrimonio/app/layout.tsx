import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Clymo Patrimonio · Staging privado',
  description: 'Acceso autorizado a hogares ficticios.',
  robots: { index: false, follow: false, nocache: true },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
