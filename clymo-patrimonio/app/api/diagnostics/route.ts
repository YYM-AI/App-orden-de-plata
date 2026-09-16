import { identity } from '@/server/access';
import { json, failure } from '@/server/http';
export async function GET() {
  try {
    await identity();
    return json({
      environment: 'synthetic-staging',
      commit: process.env.CLYMO_BUILD_COMMIT,
      workingTreeChanges: process.env.CLYMO_BUILD_DIRTY === 'yes',
      persistence: 'PostgreSQL / Supabase',
    });
  } catch (e) {
    return failure(e);
  }
}
