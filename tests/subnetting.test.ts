import { describe, it, expect } from 'vitest';
import {
  hostsToPrefix,
  ipToInt,
  intToIp,
  maskFor,
  overlapRanges,
  parseNetwork,
  parsePrefix,
  subnet,
} from '../src/calculators/ipv4';
describe('IPv4 subnet boundaries', () => {
  it('calculates the coursework /27 example', () => {
    const r = subnet('172.81.42.50', 27);
    expect(r).toMatchObject({
      network: '172.81.42.32',
      broadcast: '172.81.42.63',
      first: '172.81.42.33',
      last: '172.81.42.62',
      mask: '255.255.255.224',
      wildcard: '0.0.0.31',
      usable: 30,
      size: 32,
      blockSize: 32,
    });
  });
  it.each([
    [0, '0.0.0.0', '255.255.255.255', 4294967294],
    [1, '128.0.0.0', '255.255.255.255', 2147483646],
    [24, '255.255.255.0', '255.255.255.255', 254],
    [30, '255.255.255.252', '255.255.255.255', 2],
  ])('handles /%i without signed overflow', (p, network, broadcast, usable) => {
    expect(subnet('255.255.255.255', p)).toMatchObject({ network, broadcast, usable });
  });
  it('treats /31 as point-to-point and /32 as a host route', () => {
    expect(subnet('192.0.2.11', 31)).toMatchObject({
      network: '192.0.2.10',
      first: '192.0.2.10',
      last: '192.0.2.11',
      broadcast: null,
      usable: 2,
    });
    expect(subnet('255.255.255.255', 32)).toMatchObject({
      first: '255.255.255.255',
      last: '255.255.255.255',
      broadcast: null,
      usable: 1,
      next: null,
    });
  });
  it('clips previous and next networks at IPv4 limits', () => {
    expect(subnet('0.0.0.0', 0)).toMatchObject({ previous: null, next: null });
    expect(subnet('0.0.0.0', 24).previous).toBeNull();
    expect(subnet('255.255.255.255', 24).next).toBeNull();
  });
  it('roundtrips every valid mask', () => {
    for (let p = 0; p <= 32; p++) expect(parsePrefix(maskFor(p))).toBe(p);
  });
  it.each(['255.0.255.0', '255.255.255.1', '/35', '-1', '/1.5', 'abc'])(
    'rejects invalid mask %s',
    (x) => expect(() => parsePrefix(x)).toThrow(),
  );
  it.each(['300.10.1.1', '1.2.3', '1.2.3.4.5', '1.2.3.-1', '1e2.2.3.4'])(
    'rejects malformed IPv4 %s',
    (x) => expect(() => ipToInt(x)).toThrow(),
  );
  it('roundtrips IPv4 endpoints and aligns networks', () => {
    expect(intToIp(ipToInt('255.255.255.255'))).toBe('255.255.255.255');
    expect(ipToInt('0.0.0.0')).toBe(0);
    expect(() => parseNetwork('172.16.1.50/24', true)).toThrow(/aligned/);
  });
  it('detects containment and exact overlap ranges', () => {
    expect(overlapRanges(['172.16.1.0/26', '172.16.1.32/27'])).toEqual([
      '172.16.1.0/26 overlaps 172.16.1.32/27: 172.16.1.32–172.16.1.63',
    ]);
    expect(overlapRanges(['172.16.1.0/26', '172.16.1.64/26'])).toEqual([]);
  });
  it.each([
    [22, 27],
    [12, 28],
    [7, 28],
    [2, 30],
    [1, 30],
    [4294967294, 0],
  ])('sizes %i hosts as /%i', (hosts, p) => expect(hostsToPrefix(hosts).prefix).toBe(p));
  it('accounts for growth, infrastructure, and special address modes', () => {
    expect(hostsToPrefix(22, 25, 3)).toMatchObject({ target: 31, prefix: 26, unused: 31 });
    expect(hostsToPrefix(2, 0, 0, 'p2p').prefix).toBe(31);
    expect(hostsToPrefix(1, 0, 0, 'host').prefix).toBe(32);
    expect(() => hostsToPrefix(3, 0, 0, 'p2p')).toThrow();
    expect(() => hostsToPrefix(0)).toThrow();
  });
  it('satisfies containment invariants for every prefix', () => {
    for (let p = 0; p <= 32; p++) {
      const r = subnet('203.0.113.217', p);
      expect(r.startInt % r.size).toBe(0);
      expect(r.endInt - r.startInt + 1).toBe(r.size);
      expect(ipToInt(r.ip)).toBeGreaterThanOrEqual(r.startInt);
      expect(ipToInt(r.ip)).toBeLessThanOrEqual(r.endInt);
    }
  });
});
