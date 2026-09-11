import { redirect } from 'next/navigation';
import { identity } from '@/server/access';
import { DemoProvider } from '@/components/demo-provider';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  try {
    await identity();
  } catch {
    redirect('/login?error=access');
  }
  return (
    <DemoProvider>
      <Shell>{children}</Shell>
    </DemoProvider>
  );
}
