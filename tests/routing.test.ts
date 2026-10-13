import { describe, it, expect } from 'vitest';
import { staticRoute, RouteInput } from '../src/calculators/routing';
const base: RouteInput = {
  destination: '81.42.38.128/27',
  nextHop: '81.42.38.98',
  exitInterface: '',
  distance: 1,
  connected: ['81.42.38.96/30'],
  floating: false,
  primaryDistance: 1,
  localAddress: '81.42.38.97',
};
describe('static routing', () => {
  it('generates the expected command', () =>
    expect(staticRoute(base).command).toBe('ip route 81.42.38.128 255.255.255.224 81.42.38.98'));
  it('generates default and fully specified floating routes', () => {
    expect(staticRoute({ ...base, destination: '0.0.0.0/0' }).command).toBe(
      'ip route 0.0.0.0 0.0.0.0 81.42.38.98',
    );
    expect(
      staticRoute({
        ...base,
        exitInterface: 'Gi0/1',
        distance: 200,
        floating: true,
        primaryDistance: 110,
      }).command,
    ).toBe('ip route 81.42.38.128 255.255.255.224 Gi0/1 81.42.38.98 200');
  });
  it('rejects a floating distance not greater than primary', () =>
    expect(() =>
      staticRoute({ ...base, floating: true, distance: 100, primaryDistance: 110 }),
    ).toThrow(/greater/));
  it.each(['81.42.38.96', '81.42.38.99', '81.42.38.97', '224.0.0.1', '0.0.0.0', '127.0.0.1'])(
    'rejects invalid next hop %s',
    (nextHop) => expect(() => staticRoute({ ...base, nextHop })).toThrow(),
  );
  it('accepts /31 endpoints and /32 host destinations', () => {
    expect(
      staticRoute({
        ...base,
        destination: '192.0.2.10/32',
        nextHop: '192.0.2.3',
        connected: ['192.0.2.2/31'],
      }).destination.prefix,
    ).toBe(32);
  });
  it('warns about recursive next hops and directly connected destinations', () => {
    expect(staticRoute({ ...base, connected: [] }).warnings.join()).toMatch(/reachability/);
    expect(staticRoute({ ...base, destination: '81.42.38.96/30' }).warnings.join()).toMatch(
      /directly connected/,
    );
  });
  it('normalizes destination host bits and blocks command injection', () => {
    expect(staticRoute({ ...base, destination: '81.42.38.130/27' }).warnings.join()).toMatch(
      /normalized/,
    );
    expect(() => staticRoute({ ...base, exitInterface: 'Gi0/1\nip route bad' })).toThrow(
      /interface/,
    );
    expect(() => staticRoute({ ...base, nextHop: '', exitInterface: '' })).toThrow(/Provide/);
  });
});
