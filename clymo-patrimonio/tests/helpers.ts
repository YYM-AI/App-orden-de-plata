import { applyCommand, type Command } from '../domain/commands';
import type { DemoState } from '../domain/model';
export const context = (id = 'test-command') => ({
  id,
  recordedAt: '2026-09-06T12:00:00Z',
  actorId: 'user-demo',
});
export const command = (state: DemoState, command: Command, id?: string) =>
  applyCommand(state, command, context(id));
export const manual = (overrides: Record<string, unknown> = {}): Command =>
  ({
    type: 'add_manual',
    name: 'Ahorro ficticio Demo',
    amount: '100000',
    currency: 'CLP',
    percentage: '100',
    effectiveDate: '2026-09-04',
    side: 'asset',
    category: 'cash',
    ...overrides,
  }) as Command;
