import type { SupabaseClient } from '@supabase/supabase-js';
import type { DemoState } from '@/domain/model';
import { validateState } from '@/domain/validation';
import { calculateSnapshot } from '@/domain/engine';
import type { PrototypeRepository } from './repository';
export class DatabaseError extends Error {
  constructor(public code: string) {
    super(
      code === 'PT409' || code === '40001'
        ? 'Otra sesión cambió el hogar. Recarga antes de guardar.'
        : 'Operación de base de datos no autorizada o inválida.',
    );
  }
}
export class SupabaseRepository implements PrototypeRepository {
  constructor(
    private db: SupabaseClient,
    private householdId: string,
    private commandId = crypto.randomUUID(),
    private action = 'settings',
  ) {}
  async load(): Promise<DemoState | null> {
    const { data, error } = await this.db.rpc('read_household', { p_household: this.householdId });
    if (error) throw new DatabaseError(error.code);
    return data ? validateState(data) : null;
  }
  async save(state: DemoState, expectedRevision: number | null) {
    if (expectedRevision === null) throw new DatabaseError('initialization_required');
    const validated = validateState(state);
    const { error } = await this.db.rpc('save_household', {
      p_household: this.householdId,
      p_expected_revision: expectedRevision,
      p_state: validated,
      p_snapshot: calculateSnapshot(validated),
      p_command_id: this.commandId,
      p_action: this.action,
    });
    if (error) throw new DatabaseError(error.code);
  }
  async reset(state: DemoState) {
    const valid = validateState(state);
    const { error } = await this.db.rpc('reset_household', {
      p_household: this.householdId,
      p_state: valid,
      p_snapshot: calculateSnapshot(valid),
    });
    if (error) throw new DatabaseError(error.code);
  }
}
