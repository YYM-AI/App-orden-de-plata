import { z } from 'zod';
import { householdAccess } from '@/server/access';
import { body, origin, failure } from '@/server/http';
import { validateState } from '@/domain/validation';
import { calculateSnapshot } from '@/domain/engine';
import { householdCsv } from '@/server/export';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    origin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const { db } = await householdAccess(id, true);
    const { format } = z.object({ format: z.enum(['json', 'csv']) }).parse(await body(request));
    const { data: exportData, error: exportError } = await db.rpc('export_household', {
      p_household: id,
    });
    if (exportError || !exportData) throw exportError;
    const state = validateState(exportData.state);
    const history = exportData.history;
    const generatedAt = new Date().toISOString();
    const content =
      format === 'csv'
        ? householdCsv(state, generatedAt)
        : JSON.stringify(
            {
              exportVersion: 'clymo-export-2',
              generatedAt,
              householdId: id,
              synthetic: true,
              notice: 'STAGING — DATOS FICTICIOS',
              reportingCurrency: state.settings.reportingCurrency,
              state,
              snapshot: calculateSnapshot(state),
              history,
            },
            null,
            2,
          );
    const { error } = await db.rpc('record_audit', {
      p_household: id,
      p_event: 'export_' + format,
    });
    if (error) throw error;
    return new Response(content, {
      headers: {
        'Content-Type':
          format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="clymo-synthetic-${id}.${format}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
