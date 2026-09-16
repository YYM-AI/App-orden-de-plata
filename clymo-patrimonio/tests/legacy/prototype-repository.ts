import type { DemoState } from '../../domain/model';
import { validateState } from '../../domain/validation';
export interface PrototypeRepository {
  load(): Promise<DemoState | null>;
  save(state: DemoState, expectedRevision: number | null): Promise<void>;
  reset(state: DemoState): Promise<void>;
}
export const STORAGE_KEY = 'clymo-patrimonio:synthetic:v1';
export class LocalPrototypeRepository implements PrototypeRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
  async load(): Promise<DemoState | null> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    try {
      return validateState(JSON.parse(raw));
    } catch {
      throw Error(
        'Los datos locales no son válidos. No los sobrescribimos. Puedes restablecer la demostración.',
      );
    }
  }
  async save(state: DemoState, expectedRevision: number | null): Promise<void> {
    const current = await this.load();
    if ((current?.revision ?? null) !== expectedRevision)
      throw Error('Otra pestaña cambió la demostración. Recarga antes de guardar.');
    this.storage.setItem(STORAGE_KEY, JSON.stringify(validateState(state)));
  }
  async reset(state: DemoState): Promise<void> {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(validateState(state)));
  }
}
export class MemoryPrototypeRepository implements PrototypeRepository {
  private state: DemoState | null = null;
  async load() {
    return this.state ? structuredClone(this.state) : null;
  }
  async save(state: DemoState, expectedRevision: number | null) {
    if ((this.state?.revision ?? null) !== expectedRevision) throw Error('Conflicto de revisión.');
    this.state = validateState(state);
  }
  async reset(state: DemoState) {
    this.state = validateState(state);
  }
}
