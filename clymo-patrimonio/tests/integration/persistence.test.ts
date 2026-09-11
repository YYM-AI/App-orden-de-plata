import { describe, it, expect } from 'vitest';
import {
  LocalPrototypeRepository,
  MemoryPrototypeRepository,
  STORAGE_KEY,
} from '../legacy/prototype-repository';
import { createFixture } from '../../data/fixture';
import { calculateSnapshot } from '../../domain/engine';
import { command, manual } from '../helpers';
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}
describe('replaceable local prototype repository', () => {
  it('persists commands, decisions and originals across a new repository instance', async () => {
    const backing = storage(),
      repo = new LocalPrototypeRepository(backing),
      initial = createFixture();
    await repo.save(initial, null);
    const next = command(initial, manual());
    await repo.save(next, 0);
    const loaded = await new LocalPrototypeRepository(backing).load();
    expect(loaded).toEqual(next);
    expect(calculateSnapshot(loaded!).netWorth).toBe('52640000');
  });
  it('rejects stale saves instead of overwriting another tab', async () => {
    const repo = new LocalPrototypeRepository(storage()),
      initial = createFixture();
    await repo.save(initial, null);
    await repo.save(command(initial, manual()), 0);
    await expect(repo.save(initial, 0)).rejects.toThrow('Otra pestaña');
  });
  it('preserves malformed stored data and fails visibly', async () => {
    const backing = storage();
    backing.setItem(STORAGE_KEY, 'invalid');
    const repo = new LocalPrototypeRepository(backing);
    await expect(repo.load()).rejects.toThrow('no son válidos');
    expect(backing.getItem(STORAGE_KEY)).toBe('invalid');
    await expect(repo.save(createFixture(), null)).rejects.toThrow();
  });
  it('reset recovers canonical totals, settings and review state', async () => {
    const repo = new LocalPrototypeRepository(storage());
    const changed = command(createFixture(), manual());
    await repo.save(changed, null);
    await repo.reset(createFixture());
    const s = (await repo.load())!;
    expect(calculateSnapshot(s).netWorth).toBe('52540000');
    expect(s.appliedCommands).toEqual([]);
    expect(s.settings.reportingCurrency).toBe('CLP');
  });
  it('storage denial and quota failures propagate without a false successful save', async () => {
    const repo = new LocalPrototypeRepository({
      getItem: () => null,
      setItem: () => {
        throw Error('QuotaExceededError');
      },
    });
    await expect(repo.save(createFixture(), null)).rejects.toThrow('Quota');
  });
  it('domain engine works with in-memory storage without browser or database dependencies', async () => {
    const repo = new MemoryPrototypeRepository();
    await repo.save(createFixture(), null);
    const loaded = (await repo.load())!;
    loaded.balances[0].amount = '0';
    expect(calculateSnapshot((await repo.load())!).netWorth).toBe('52540000');
  });
});
