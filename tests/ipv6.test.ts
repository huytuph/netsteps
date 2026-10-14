import { describe, expect, it } from 'vitest';
import {
  IPV6_MAX,
  binaryIPv6,
  compressIPv6,
  expandIPv6,
  ipv6Address,
  ipv6OverlapCheck,
  ipv6Prefix,
  ipv6StaticRoute,
  ipv6Subnet,
  ipv6Type,
  parseBinaryIPv6,
  parseIPv6,
  parseIPv6Network,
  planIPv6,
} from '../src/calculators/ipv6';
import { checkAnswer, makeQuestion, topics } from '../src/calculators/practice';
import { questionLesson } from '../src/explanations/lessons';
import { calculate } from '../src/pages/calculate';
import { baseValues, blankRow, formFields, initialRows } from '../src/pages/forms';
import { defaults, entry, validateWorkspace } from '../src/app/storage';
import type { RouteInput } from '../src/calculators/routing';

describe('IPv6 address parsing and canonical formatting', () => {
  it.each([
    ['::', '::'],
    ['::1', '::1'],
    ['FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
    ['2001:0DB8:0000:0000:0001:0000:0000:0001', '2001:db8::1:0:0:1'],
    ['2001:db8:0:1:2:3:4:5', '2001:db8:0:1:2:3:4:5'],
    ['0:0:1:0:0:0:0:0', '0:0:1::'],
    ['0:0:0:0:0:1:0:0', '::1:0:0'],
    ['1:2:3:4:5:6::8', '1:2:3:4:5:6:0:8'],
    ['::ffff:192.0.2.128', '::ffff:c000:280'],
    ['2001:db8::192.0.2.1', '2001:db8::c000:201'],
  ])('canonicalizes %s', (input, expected) => {
    expect(compressIPv6(input)).toBe(expected);
    expect(parseIPv6(expandIPv6(input))).toBe(parseIPv6(input));
    expect(expandIPv6(input).split(':')).toHaveLength(8);
  });
  it.each([
    '',
    '1',
    '192.0.2.1',
    '2001:db8:::1',
    '::1::',
    '1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7:8::',
    ':1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:',
    '2001:db8::gggg',
    '::12345',
    '[::1]',
    'fe80::1%eth0',
    '::1/64',
    '::ffff:256.0.0.1',
    '::ffff:1.2.3',
    '::192.0.2.1:1',
    ':: 1',
  ])('rejects malformed address %s', (input) => expect(() => parseIPv6(input)).toThrow());
  it('keeps all 128 bits in binary and reverse conversions', () => {
    for (const n of [0n, 1n, IPV6_MAX, parseIPv6('2001:db8:1234:5678:9abc:def0:1122:3344')]) {
      expect(parseBinaryIPv6(binaryIPv6(n))).toBe(n);
      expect(parseBinaryIPv6(n.toString(2).padStart(128, '0'))).toBe(n);
    }
    for (const bad of [
      '',
      '1'.repeat(127),
      '2'.repeat(128),
      '0'.repeat(16) + ':0',
      '0'.repeat(129),
    ])
      expect(() => parseBinaryIPv6(bad)).toThrow();
    expect(() => expandIPv6(-1n)).toThrow();
    expect(() => compressIPv6(IPV6_MAX + 1n)).toThrow();
  });
  it.each([
    ['::', 'Unspecified'],
    ['::1', 'Loopback'],
    ['fe80::1', 'Link-local unicast'],
    ['febf::1', 'Link-local unicast'],
    ['fec0::1', 'Deprecated site-local'],
    ['fd00::1', 'Unique-local unicast'],
    ['fc00::1', 'Unique-local unicast'],
    ['ff02::1', 'Multicast'],
    ['2001:db8::1', 'Documentation'],
    ['2001:4860::1', 'Global unicast space'],
    ['::ffff:192.0.2.1', 'IPv4-mapped'],
  ])('classifies %s', (address, type) => expect(ipv6Type(parseIPv6(address)).type).toBe(type));
  it('derives solicited-node multicast from the low 24 bits only', () => {
    expect(ipv6Address('2001:db8::1234:5678').solicitedNode).toBe('ff02::1:ff34:5678');
    for (const ip of ['::', '::1', 'ff02::1', '::ffff:192.0.2.1'])
      expect(ipv6Address(ip).solicitedNode).toBeNull();
  });
});
describe('IPv6 prefix math and allocation', () => {
  it('covers every prefix with exact boundaries and capacity', () => {
    const address = parseIPv6('ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffd');
    for (let p = 0; p <= 128; p++) {
      const n = ipv6Subnet(compressIPv6(address), p);
      expect(n.size).toBe(1n << BigInt(128 - p));
      expect(n.start % n.size).toBe(0n);
      expect(n.start <= address && n.end >= address).toBe(true);
      expect(n.end - n.start + 1n).toBe(n.size);
      expect(parseIPv6(n.network)).toBe(n.start);
      expect(parseIPv6(n.last)).toBe(n.end);
    }
    expect(ipv6Subnet('::', 0).size.toString()).toBe('340282366920938463463374607431768211456');
    expect(ipv6Subnet('2001:db8::', 64).size.toString()).toBe('18446744073709551616');
    expect(ipv6Subnet('::1', 127).size).toBe(2n);
    expect(ipv6Subnet('::1', 128).network).toBe('::1');
  });
  it('handles hextet-splitting prefixes and address space endpoints', () => {
    const n = ipv6Subnet('2001:db8:abcd:ffff:ffff::1', 61);
    expect(n.network).toBe('2001:db8:abcd:fff8::');
    expect(n.last).toBe('2001:db8:abcd:ffff:ffff:ffff:ffff:ffff');
    expect(ipv6Subnet('::', 0).previous).toBeNull();
    expect(ipv6Subnet('::', 0).next).toBeNull();
    expect(ipv6Subnet(compressIPv6(IPV6_MAX), 128).next).toBeNull();
    for (const p of ['', '/', '129', '-1', '64.5', '255.255.255.0', '64/1'])
      expect(() => ipv6Prefix(p)).toThrow();
    expect(() => parseIPv6Network('2001:db8::1/64', true)).toThrow(/aligned/);
    expect(() => parseIPv6Network('::/0/0')).toThrow();
  });
  it('detects nested, duplicate and normalized overlap while allowing adjacency', () => {
    expect(ipv6OverlapCheck(['2001:db8::/64', '2001:db8:0:1::/64']).conflicts).toEqual([]);
    expect(
      ipv6OverlapCheck(['2001:db8::/48', '2001:db8::1/64', '2001:db8::/64']).conflicts,
    ).toHaveLength(3);
    expect(() => ipv6OverlapCheck(['::/0'])).toThrow();
  });
  it('allocates largest first around locks and accounts for all free space', () => {
    const plan = planIPv6('2001:db8::/60', [
      { name: 'Locked LAN', prefix: '/64', locked: '2001:db8:0:1::/64' },
      { name: 'LAN', prefix: '/64' },
      { name: 'Aggregate', prefix: '/62' },
    ]);
    expect(plan.allocations.find((a) => a.name === 'Aggregate')!.subnet.network).toBe(
      '2001:db8:0:4::',
    );
    expect(plan.allocations.find((a) => a.name === 'LAN')!.subnet.network).toBe('2001:db8::');
    expect(plan.remaining).toBe((16n - 6n) * (1n << 64n));
    expect(plan.remaining + plan.allocations.reduce((n, a) => n + a.subnet.size, 0n)).toBe(
      plan.base.size,
    );
    const prefixes = plan.allocations.map((a) => `${a.subnet.network}/${a.subnet.prefix}`);
    expect(ipv6OverlapCheck(prefixes).conflicts).toEqual([]);
  });
  it('allows two /127 addresses and a single /128 allocation', () => {
    const p = planIPv6('2001:db8::/127', [
      { name: 'A', prefix: '128' },
      { name: 'B', prefix: '128' },
    ]);
    expect(p.allocations.map((a) => a.subnet.network)).toEqual(['2001:db8::', '2001:db8::1']);
    expect(p.free).toEqual([]);
    expect(p.remaining).toBe(0n);
  });
  it('rejects capacity, alignment, lock, prefix and name conflicts', () => {
    const base = '2001:db8::/64';
    for (const rows of [
      [],
      [{ name: '', prefix: '64' }],
      [{ name: 'A', prefix: '' }],
      [{ name: 'A', prefix: '63' }],
      [
        { name: 'A', prefix: '64' },
        { name: 'a', prefix: '64' },
      ],
      [
        { name: 'A', prefix: '64' },
        { name: 'B', prefix: '64' },
      ],
      [{ name: 'A', prefix: '65', locked: '2001:db8::/64' }],
      [{ name: 'A', prefix: '64', locked: '2001:db8:1::/64' }],
      [{ name: 'A', prefix: '65', locked: '2001:db8::1/65' }],
      [
        { name: 'A', prefix: '65', locked: '2001:db8::/65' },
        { name: 'B', prefix: '65', locked: '2001:db8::/65' },
      ],
    ])
      expect(() => planIPv6(base, rows)).toThrow();
  });
  it('preserves manual allocation order', () => {
    const p = planIPv6(
      '2001:db8::/60',
      [
        { name: 'Small', prefix: '64' },
        { name: 'Large', prefix: '62' },
      ],
      false,
    );
    expect(p.allocations.map((a) => a.name)).toEqual(['Small', 'Large']);
    expect(p.allocations[1].subnet.network).toBe('2001:db8:0:4::');
  });
});
describe('IPv6 routes and integrated study workflow', () => {
  const route = (changes: Partial<RouteInput> = {}) =>
    ipv6StaticRoute({
      destination: '2001:db8:2::1/64',
      nextHop: '2001:db8:1::2',
      exitInterface: '',
      distance: 1,
      connected: ['2001:db8:1::/64'],
      floating: false,
      primaryDistance: 1,
      ...changes,
    });
  it('builds normalized recursive, default, link-local and floating routes', () => {
    expect(route().command).toBe('ipv6 route 2001:db8:2::/64 2001:db8:1::2');
    expect(route().warnings).toContain('Destination normalized to 2001:db8:2::/64.');
    expect(
      route({
        destination: '::/0',
        nextHop: 'fe80::2',
        exitInterface: 'Gi0/0',
        floating: true,
        distance: 10,
      }).command,
    ).toBe('ipv6 route ::/0 Gi0/0 fe80::2 10');
    expect(route({ nextHop: '', exitInterface: 'Serial0/0' }).warnings.join()).toMatch(
      /point-to-point/,
    );
  });
  it('requires the link-local scope interface and rejects invalid neighbors and distances', () => {
    for (const nextHop of ['::', '::1', 'ff02::1', '::ffff:192.0.2.1', 'fe80::2'])
      expect(() => route({ nextHop })).toThrow();
    expect(() => route({ localAddress: '2001:0db8:1:0:0:0:0:2' })).toThrow(/local router/);
    expect(() => route({ nextHop: '', exitInterface: '' })).toThrow();
    expect(() => route({ distance: NaN })).toThrow();
    expect(() => route({ floating: true, distance: 1, primaryDistance: 1 })).toThrow(/greater/);
    expect(() => route({ exitInterface: 'Gi0/0\nipv6 unicast-routing' })).toThrow();
    expect(route({ connected: [] }).warnings.join()).toMatch(/reachability/);
    expect(route({ destination: '2001:db8:1::/64' }).warnings.join()).toMatch(/directly connected/);
  });
  it('generates lessons for all IPv6 question topics at every difficulty', () => {
    for (const topic of topics.filter((t) => t.startsWith('IPv6')))
      for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        const q = makeQuestion(topic, difficulty);
        expect(q.answers.every((a) => checkAnswer(a.value, a.value, topic))).toBe(true);
        const l = questionLesson(q);
        expect(l.methods.recommended.length).toBeGreaterThan(0);
        expect(l.metrics.length).toBeGreaterThan(0);
      }
  });
  it('checks canonical compression, full expansion and equivalent prefix and route addresses', () => {
    expect(checkAnswer('2001:0db8::1', '2001:db8::1', 'IPv6 compression')).toBe(false);
    expect(checkAnswer('2001:DB8::1', '2001:db8::1', 'IPv6 compression')).toBe(false);
    expect(checkAnswer('2001:DB8::1', '2001:db8::1', 'IPv6 expansion')).toBe(false);
    expect(
      checkAnswer(
        '2001:0DB8:0000:0000:0000:0000:0000:0001',
        '2001:0db8:0000:0000:0000:0000:0000:0001',
        'IPv6 expansion',
      ),
    ).toBe(true);
    expect(checkAnswer('2001:0DB8:0:0:0:0:0:0/64', '2001:db8::/64', 'IPv6 network prefix')).toBe(
      true,
    );
    expect(checkAnswer('2001:db8::1/64', '2001:db8::/64', 'IPv6 network prefix')).toBe(false);
    expect(
      checkAnswer(
        'ipv6 route 2001:0DB8:2:0:0:0:0:0/64 2001:0DB8:1:0:0:0:0:2',
        'ipv6 route 2001:db8:2::/64 2001:db8:1::2',
        'IPv6 static routing',
      ),
    ).toBe(true);
    expect(
      checkAnswer('ipv6 route bad::ip/64 ::2', 'ipv6 route ::/64 ::2', 'IPv6 static routing'),
    ).toBe(false);
  });
  it('validates custom IPv6 questions rather than substituting sample inputs', () => {
    const c = {
      ip: '2001:db8::abcd',
      prefix: '64',
      hosts: 0,
      requirements: [],
      nextHop: 'fe80::2',
      exitInterface: 'Gi0/0',
    };
    expect(makeQuestion('IPv6 static routing', 'Custom', c).answers[0].value).toBe(
      'ipv6 route 2001:db8::/64 Gi0/0 fe80::2',
    );
    expect(() => makeQuestion('IPv6 expansion', 'Custom', { ...c, ip: '' })).toThrow();
    expect(() => makeQuestion('IPv6 network prefix', 'Custom', { ...c, prefix: '' })).toThrow();
  });
  it('keeps inputs empty, preserves backups, and exports only serializable lesson strings', () => {
    expect(initialRows('IPv6')).toEqual([{ name: '', prefix: '', locked: '' }]);
    expect(blankRow('IPv6').prefix).toBe('');
    for (const [k, v] of Object.entries(baseValues.IPv6!))
      if (!['mode', 'order'].includes(k)) expect(v).toBe('');
    expect(
      formFields('IPv6', { ...baseValues.IPv6!, mode: 'plan' }, initialRows('IPv6')),
    ).toContain('r-0-prefix');
    const values = { ...baseValues.IPv6!, mode: 'subnet', address: '2001:db8::1', prefix: '64' };
    const l = calculate('IPv6', values, []);
    expect(JSON.stringify(l)).toContain('18446744073709551616');
    const w = defaults();
    w.saved = [entry('IPv6', values, [], 'IPv6 lab', l.summary)];
    expect(validateWorkspace(JSON.parse(JSON.stringify(w))).saved[0].tab).toBe('IPv6');
  });
});
