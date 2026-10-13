import { describe, it, expect } from 'vitest';
import { planVlsm, Requirement } from '../src/calculators/vlsm';
import { overlaps } from '../src/calculators/ipv4';
const row = (
  name: string,
  hosts: number,
  locked = '',
  mode: Requirement['mode'] = 'lan',
): Requirement => ({ name, hosts, locked, mode });
describe('VLSM allocation', () => {
  it('allocates largest first and exposes remaining ranges', () => {
    const r = planVlsm('172.81.42.0/24', [row('Branch', 7), row('HQ', 22), row('Transit', 2)]);
    expect(r.allocations.map((a) => [a.name, a.subnet.network, a.subnet.prefix])).toEqual([
      ['HQ', '172.81.42.0', 27],
      ['Branch', '172.81.42.32', 28],
      ['Transit', '172.81.42.48', 30],
    ]);
    expect(r.remaining).toBe(204);
  });
  it('allocates around locks without overlaps', () => {
    const r = planVlsm('10.0.0.0/24', [
      row('Locked', 2, '10.0.0.32/30'),
      row('Big', 30),
      row('Other', 30),
    ]);
    expect(r.allocations.find((a) => a.name === 'Other')?.subnet.network).toBe('10.0.0.64');
    for (let i = 0; i < r.allocations.length; i++)
      for (let j = i + 1; j < r.allocations.length; j++)
        expect(overlaps(r.allocations[i].subnet, r.allocations[j].subnet)).toBe(false);
    expect(r.free.reduce((n, r) => n + r.size, 0)).toBe(r.remaining);
  });
  it('honors manual order and alignment', () => {
    const r = planVlsm('10.0.0.0/24', [row('Small', 2), row('Big', 30)], false);
    expect(r.allocations.map((a) => a.subnet.network)).toEqual(['10.0.0.0', '10.0.0.32']);
    expect(r.free[0]).toMatchObject({ start: '10.0.0.4', end: '10.0.0.31', size: 28 });
  });
  it('rejects overlapping, undersized and external locks', () => {
    expect(() =>
      planVlsm('10.0.0.0/24', [row('A', 2, '10.0.0.0/26'), row('B', 2, '10.0.0.32/27')]),
    ).toThrow(/overlaps/);
    expect(() => planVlsm('10.0.0.0/24', [row('A', 22, '10.0.0.0/30')])).toThrow(/cannot fit/);
    expect(() => planVlsm('10.0.0.0/24', [row('A', 2, '10.0.1.0/30')])).toThrow(/outside/);
  });
  it('rejects insufficient or fragmented capacity', () => {
    expect(() => planVlsm('10.0.0.0/30', [row('A', 2), row('B', 2)])).toThrow(/Insufficient/);
    expect(() =>
      planVlsm('10.0.0.0/26', [
        row('A', 2, '10.0.0.0/30'),
        row('B', 2, '10.0.0.32/30'),
        row('C', 30),
      ]),
    ).toThrow(/Insufficient/);
  });
  it('supports /31 and /32 explicitly, including max address', () => {
    const r = planVlsm('255.255.255.252/30', [
      row('P2P', 2, '', 'p2p'),
      row('Host', 1, '', 'host'),
    ]);
    expect(r.allocations.map((a) => a.subnet.prefix)).toEqual([31, 32]);
    expect(r.remaining).toBe(1);
    expect(planVlsm('255.255.255.255/32', [row('Host', 1, '', 'host')]).remaining).toBe(0);
  });
  it('does not accidentally allocate /31 for traditional links', () =>
    expect(planVlsm('10.0.0.0/24', [row('Transit', 2)]).allocations[0].subnet.prefix).toBe(30));
  it('rejects duplicate names and invalid requirements', () => {
    expect(() => planVlsm('10.0.0.0/24', [row('A', 2), row('A', 2)])).toThrow(/unique/);
    expect(() => planVlsm('10.0.0.0/24', [row('A', 0)])).toThrow();
  });
});
