import type { DemoState } from '@/domain/model';
export interface PrototypeRepository {
  load(): Promise<DemoState | null>;
  save(state: DemoState, expectedRevision: number | null): Promise<void>;
  reset(state: DemoState): Promise<void>;
}
