import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Clymo Patrimonio · Demostración', description: 'Una visión explicable del patrimonio de un hogar ficticio.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="es-CL"><body>{children}</body></html>; }
