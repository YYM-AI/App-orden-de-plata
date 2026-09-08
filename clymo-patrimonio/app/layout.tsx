import type { Metadata } from 'next';
import { DemoProvider } from '@/components/demo-provider';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: 'Clymo Patrimonio · Demostración',
  description: 'Tu hogar ficticio, sus fuentes y un patrimonio que puedes explicar.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        <DemoProvider>
          <Shell>{children}</Shell>
        </DemoProvider>
      </body>
    </html>
  );
}
