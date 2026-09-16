import { describe, it, expect } from 'vitest';
import { householdFixture } from '../../data/households';
import { calculateSnapshot } from '../../domain/engine';
import { csvCell, householdCsv } from '../../server/export';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const h = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
describe('multi-household fixtures', () => {
  it('retains all four canonical values under real identity IDs', () => {
    const s = householdFixture(h, 'Familia Demo Clymo', owner, 'canonical');
    expect(calculateSnapshot(s)).toMatchObject({
      assets: '60240000',
      liabilities: '7700000',
      netWorth: '52540000',
      liquidCash: '25250000',
    });
    expect(s.ownershipDecisions.every((d) => d.actorId === owner && d.householdId === h)).toBe(
      true,
    );
  });
  it('isolates the northern fixture and its own USD conversion', () => {
    const s = householdFixture(h, 'Familia Norte Demo', owner, 'north');
    expect(calculateSnapshot(s)).toMatchObject({
      assets: '2000000',
      liabilities: '100000',
      netWorth: '1900000',
      liquidCash: '2000000',
    });
    expect(JSON.stringify(s)).not.toMatch(/Santander|María|broker-copy/);
  });
  it('creates an empty financial household with an owner', () => {
    const s = householdFixture(h, 'Hogar Vacío Demo', owner, 'empty');
    expect(calculateSnapshot(s)).toMatchObject({
      assets: '0',
      liabilities: '0',
      netWorth: '0',
      liquidCash: '0',
    });
    expect(s.accounts).toHaveLength(0);
    expect(s.memberships[0].userId).toBe(owner);
  });
});
describe('safe downloadable CSV', () => {
  it.each(['=1+1', '+SUM(A1)', '-1+1', '@cmd', '\t=1', '\r=1', '\n=1', '  =1'])(
    'neutralizes formula prefix %j',
    (v) => expect(csvCell(v)).toBe('"\'' + v + '"'),
  );
  it('escapes quotes, comma and accented UTF-8 text', () =>
    expect(csvCell('María, "Demo"')).toBe('"María, ""Demo"""'));
  it('contains version, date, household, provenance and excluded rows', () => {
    const csv = householdCsv(
      householdFixture(h, 'Familia Demo Clymo', owner, 'canonical'),
      '2026-09-08T00:00:00Z',
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    for (const v of ['clymo-export-2', h, '2026-09-08T00:00:00Z', 'EUR', 'USD', 'María', '"NO"'])
      expect(csv).toContain(v);
    expect(csv.split('\r\n')).toHaveLength(15);
    expect(csv).not.toMatch(/password|token|service_role/);
  });
});
