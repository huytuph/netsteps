import { describe, it, expect } from 'vitest';
import { convertInteger } from '../src/calculators/numbers';
import { integerLesson } from '../src/explanations/integer';
import {
  dynamicNat,
  tunnelPlan,
  frameRelayPlan,
  ospfv3Plan,
  TunnelInput,
  DynamicNatInput,
  OspfInterface,
} from '../src/calculators/wan';
import { distanceVector } from '../src/calculators/distance-vector';
import { distanceVectorLesson } from '../src/explanations/wan';
import { calculate } from '../src/pages/calculate';
import { baseValues, blankRow, initialRows } from '../src/pages/forms';
import { readRows } from '../src/components/ui';
import { defaults, entry, validateWorkspace } from '../src/app/storage';
describe('Test 1 number systems', () => {
  it('handles all three-digit numbers and verifies hexadecimal back to decimal', () => {
    for (let n = 0; n <= 999; n++) {
      const r = convertInteger(String(n).padStart(3, '0'), 'decimal', 'hex');
      expect(convertInteger(r.output, 'hex', 'decimal').value).toBe(BigInt(n));
    }
    const r = convertInteger('567', 'decimal', 'hex');
    expect(r.output).toBe('237');
    expect(
      integerLesson(r)
        .methods.division.map((s) => s.text)
        .join('\n'),
    ).toContain('567 ÷ 16 = 35, remainder 7');
    const back = integerLesson(convertInteger('237', 'hex', 'decimal'));
    expect(back.methods.place[0].text).toBe('2 × 16^2 = 512');
    expect(back.methods.place[1].text).toBe('3 × 16^1 = 48');
    expect(back.methods.place[2].text).toBe('7 × 16^0 = 7');
  });
  it('keeps precision above Number.MAX_SAFE_INTEGER and rejects invalid or excessive integers', () => {
    const n = (1n << 255n) + 123n;
    expect(
      convertInteger(convertInteger(String(n), 'decimal', 'hex').output, 'hex', 'decimal').value,
    ).toBe(n);
    for (const s of ['', '-1', '1.2', 'abc', String(1n << 256n)])
      expect(() => convertInteger(s, 'decimal', 'binary')).toThrow();
    expect(JSON.stringify(integerLesson(convertInteger('999', 'decimal', 'binary')))).toContain(
      '1111100111',
    );
  });
  it('explicitly states eight bits per IPv4 segment', () => {
    const l = calculate(
      'Number Systems',
      { ...baseValues['Number Systems']!, mode: 'ipv4', ipv4: '81.42.38.18' },
      [],
    );
    expect(l.metrics).toContainEqual([
      'Bits per segment',
      '8 bits per octet; 4 × 8 = 32 bits total',
    ]);
    expect(l.summary).toBe('01010001.00101010.00100110.00010010');
  });
});
const natInput: DynamicNatInput = {
  networks: ['192.168.10.0/24'],
  pool: 'POOL',
  start: '203.0.113.20',
  end: '203.0.113.60',
  prefix: '24',
  acl: 10,
  inside: 'GigabitEthernet0/0',
  outside: 'Serial0/0/0',
  insideAddress: '192.168.10.1/24',
  outsideAddress: '203.0.113.1/24',
  nextHop: '203.0.113.2',
};
describe('Test 2 dynamic NAT', () => {
  it('uses the actual subnet mask for an arbitrary pool range and omits overload', () => {
    const r = dynamicNat(natInput);
    expect(r.count).toBe(41);
    expect(r.command).toContain('ip nat pool POOL 203.0.113.20 203.0.113.60 netmask 255.255.255.0');
    expect(r.command).toContain('access-list 10 permit 192.168.10.0 0.0.0.255');
    expect(r.command).toContain('ip nat inside source list 10 pool POOL\ninterface');
    expect(r.command).not.toContain('overload');
    expect(r.command).toContain('exit\nip route 0.0.0.0 0.0.0.0 203.0.113.2');
  });
  it('rejects inverted, broadcast, overlapping and occupied pool ranges', () => {
    for (const patch of [
      { start: '203.0.113.61' },
      { end: '203.0.113.255' },
      { start: '192.168.10.20', end: '192.168.10.60' },
      { outsideAddress: '203.0.113.40/24' },
      { inside: 'Serial0/0/0' },
      { pool: 'POOL\nend' },
      { networks: [] },
      { acl: NaN },
      { prefix: '' },
    ])
      expect(() => dynamicNat({ ...natInput, ...patch })).toThrow();
  });
});
const tunnelInput: TunnelInput = {
  mode: 'ipv6ip',
  id: 0,
  a: {
    name: 'R0',
    wanInterface: 'Serial0/0/0',
    wanAddress: '192.0.2.1/30',
    underlayNextHop: '192.0.2.2',
    tunnelAddress: '2001:db8:3::1/64',
    lanInterface: 'GigabitEthernet0/0',
    lanAddress: '2001:db8:1::1/64',
  },
  b: {
    name: 'R1',
    wanInterface: 'Serial0/0/1',
    wanAddress: '198.51.100.2/30',
    underlayNextHop: '198.51.100.1',
    tunnelAddress: '2001:db8:3::2/64',
    lanInterface: 'GigabitEthernet0/0',
    lanAddress: '2001:db8:2::1/64',
  },
};
describe('Test 2 tunnels', () => {
  it('generates reciprocal IPv6-over-IPv4 endpoints, underlay host routes and both inner routes', () => {
    const r = tunnelPlan(tunnelInput);
    expect(r.command).toContain(
      'tunnel source Serial0/0/0\n tunnel destination 198.51.100.2\n tunnel mode ipv6ip',
    );
    expect(r.command).toContain('tunnel source Serial0/0/1\n tunnel destination 192.0.2.1');
    expect(r.command).toContain('ip route 198.51.100.2 255.255.255.255 192.0.2.2');
    expect(r.command).toContain('ipv6 route 2001:db8:2::/64 2001:db8:3::2');
    expect(r.command).toContain('ipv6 route 2001:db8:1::/64 2001:db8:3::1');
  });
  it('supports GRE IPv4 payloads and validates tunnel subnet and address separation', () => {
    const t: TunnelInput = {
      ...tunnelInput,
      mode: 'gre4',
      a: { ...tunnelInput.a, tunnelAddress: '10.0.0.1/30', lanAddress: '10.1.0.1/24' },
      b: { ...tunnelInput.b, tunnelAddress: '10.0.0.2/30', lanAddress: '10.2.0.1/24' },
    };
    expect(tunnelPlan(t).command).toContain('tunnel mode gre ip');
    expect(tunnelPlan(t).command).toContain('ip route 10.2.0.0 255.255.255.0 10.0.0.2');
    expect(() => tunnelPlan({ ...t, b: { ...t.b, tunnelAddress: '10.0.1.2/30' } })).toThrow(
      /same tunnel subnet/,
    );
    expect(() => tunnelPlan({ ...t, a: { ...t.a, lanAddress: '192.0.2.1/24' } })).toThrow(
      /separate/,
    );
    expect(() =>
      tunnelPlan({ ...tunnelInput, b: { ...tunnelInput.b, lanAddress: '2001:db8:1::2/64' } }),
    ).toThrow(/disjoint/);
    expect(() =>
      tunnelPlan({ ...tunnelInput, a: { ...tunnelInput.a, wanAddress: '192.0.2.0/30' } }),
    ).toThrow();
    expect(() =>
      tunnelPlan({ ...tunnelInput, a: { ...tunnelInput.a, underlayNextHop: '198.51.100.1' } }),
    ).toThrow();
  });
});
describe('Test 2 Frame Relay', () => {
  const rows = [
    {
      suffix: 1,
      dlci: 220,
      address: '10.0.1.1/30',
      peer: '10.0.1.2',
      remoteNetworks: ['10.2.0.0/24'],
    },
    {
      suffix: 2,
      dlci: 110,
      address: '10.0.2.1/30',
      peer: '10.0.2.2',
      remoteNetworks: ['10.3.0.0/24'],
    },
  ];
  it('uses subinterface IDs independently of local DLCIs, then adds routes in global mode', () => {
    const r = frameRelayPlan('R0', 'Serial0/0/0', rows, 'GigabitEthernet0/0', '10.1.0.1/24');
    expect(r.command).toContain(
      'interface Serial0/0/0\n no ip address\n encapsulation frame-relay\n no shutdown\nexit',
    );
    expect(r.command).toContain(
      'interface Serial0/0/0.1 point-to-point\n ip address 10.0.1.1 255.255.255.252\n frame-relay interface-dlci 220',
    );
    expect(r.command).toContain(
      'exit\nip route 10.2.0.0 255.255.255.0 10.0.1.2\nip route 10.3.0.0 255.255.255.0 10.0.2.2',
    );
  });
  it('rejects duplicate DLCIs/subinterfaces, wrong peers, overlapping circuits and missing LAN routes', () => {
    for (const patch of [
      { dlci: 220 },
      { suffix: 1 },
      { peer: '10.0.2.1' },
      { peer: '10.0.3.2' },
      { remoteNetworks: [] },
      { address: '10.0.1.1/30', peer: '10.0.1.2' },
    ])
      expect(() => frameRelayPlan('R0', 'S0/0/0', [rows[0], { ...rows[1], ...patch }])).toThrow();
    expect(() => frameRelayPlan('R0', 'GigabitEthernet0/0', rows)).toThrow();
  });
});
const ospfRows: OspfInterface[] = [
  {
    router: 'R0',
    routerId: '1.1.1.1',
    iface: 'Serial0/0/0',
    address: '2001:db8:12::1/64',
    area: '2000',
    passive: false,
  },
  {
    router: 'R1',
    routerId: '2.2.2.2',
    iface: 'Serial0/0/1',
    address: '2001:db8:12::2/64',
    area: '2000',
    passive: false,
  },
  {
    router: 'R0',
    routerId: '1.1.1.1',
    iface: 'GigabitEthernet0/0',
    address: '2001:db8:1::1/64',
    area: '2000',
    passive: true,
  },
];
describe('Test 2 IPv6 OSPF', () => {
  it('groups interfaces by router with unique IDs and correctly scoped passive commands', () => {
    const r = ospfv3Plan(10, ospfRows);
    expect(r.routers).toHaveLength(2);
    expect(r.command).toContain(
      'ipv6 unicast-routing\nipv6 router ospf 10\n router-id 1.1.1.1\n passive-interface GigabitEthernet0/0\nexit',
    );
    expect(r.command).toContain('ipv6 ospf 10 area 2000');
    expect(r.command).toContain('show ipv6 ospf neighbor');
    expect(r.warnings).toEqual([]);
    expect(ospfv3Plan(10, [{ ...ospfRows[0], area: '0.0.0.0' }]).interfaces[0].area).toBe('0');
  });
  it('rejects inconsistent/duplicate IDs, duplicate addresses and interfaces', () => {
    expect(() => ospfv3Plan(10, [ospfRows[0], { ...ospfRows[1], routerId: '1.1.1.1' }])).toThrow(
      /unique/,
    );
    expect(() => ospfv3Plan(10, [ospfRows[0], { ...ospfRows[2], routerId: '3.3.3.3' }])).toThrow(
      /consistent/,
    );
    expect(() => ospfv3Plan(10, [ospfRows[0], ospfRows[0]])).toThrow(/once/);
    expect(() =>
      ospfv3Plan(10, [ospfRows[0], { ...ospfRows[1], address: ospfRows[0].address }]),
    ).toThrow(/unique/);
    expect(() => ospfv3Plan(10, [{ ...ospfRows[0], address: 'fe80::1/64' }])).toThrow();
    expect(() => ospfv3Plan(10, [{ ...ospfRows[0], area: '' }])).toThrow();
    expect(() => ospfv3Plan(NaN, ospfRows)).toThrow();
  });
  it('warns about area/passive mismatches on shared prefixes', () => {
    expect(
      ospfv3Plan(10, [ospfRows[0], { ...ospfRows[1], area: '1', passive: true }]).warnings.join(),
    ).toMatch(/different OSPF area/);
    expect(
      ospfv3Plan(10, [ospfRows[0], { ...ospfRows[1], passive: true }]).warnings.join(),
    ).toMatch(/passive/);
  });
});
describe('Test 2 distance vector', () => {
  const links = [
    { a: 'A', b: 'B', cost: 1 },
    { a: 'B', b: 'C', cost: 1 },
    { a: 'C', b: 'D', cost: 1 },
    { a: 'A', b: 'D', cost: 10 },
  ];
  it('round 1 uses only round-0 neighbor vectors in simultaneous mode', () => {
    const r = distanceVector({ nodes: [], links, rounds: 1, mode: 'synchronous' }),
      t = r.states[1].table;
    expect(r.states[0].table.A.C.cost).toBe(Infinity);
    expect(t.A.C).toEqual({ cost: 2, nextHops: ['B'] });
    expect(t.A.D.cost).toBe(10);
    expect(r.converged).toBe(false);
    const second = distanceVector({ nodes: [], links, rounds: 2, mode: 'synchronous' });
    expect(second.states[2].table.A.D).toEqual({ cost: 3, nextHops: ['B'] });
    expect(second.converged).toBe(true);
  });
  it('sequential sweeps use the specified latest-table order', () => {
    const r = distanceVector({
      nodes: [],
      links,
      rounds: 1,
      mode: 'sequential',
      order: ['D', 'C', 'B', 'A'],
    });
    expect(r.states[1].table.A.D.cost).toBe(3);
    expect(() =>
      distanceVector({ nodes: [], links, rounds: 1, mode: 'sequential', order: ['A', 'B'] }),
    ).toThrow(/every router/);
  });
  it('keeps equal-cost next hops and attached destinations, including isolated routers', () => {
    const r = distanceVector({
      nodes: ['A', 'B', 'C', 'D', 'Z'],
      links: [
        { a: 'A', b: 'B', cost: 1 },
        { a: 'A', b: 'C', cost: 1 },
        { a: 'B', b: 'D', cost: 1 },
        { a: 'C', b: 'D', cost: 1 },
      ],
      attachments: [{ router: 'D', destination: 'LAN', cost: 0 }],
      rounds: 2,
      mode: 'synchronous',
    });
    expect(r.states[1].table.A.D.nextHops).toEqual(['B', 'C']);
    expect(r.states[2].table.A.LAN.cost).toBe(2);
    expect(r.states[2].table.Z.A.cost).toBe(Infinity);
    expect(JSON.stringify(distanceVectorLesson(r))).toContain('∞');
    expect(distanceVectorLesson(r).rows!.some((row) => row[0] === '0')).toBe(true);
  });
  it('validates costs, duplicate/unknown links, names and round limits', () => {
    for (const bad of [
      { links: [{ a: 'A', b: 'B', cost: -1 }] },
      { links: [{ a: 'A', b: 'A', cost: 1 }] },
      { links: [links[0], links[0]] },
      { nodes: ['A'], links: [links[0]] },
      { rounds: 0 },
      { rounds: 9 },
    ])
      expect(() =>
        distanceVector({ nodes: [], links, rounds: 1, mode: 'synchronous', ...bad }),
      ).toThrow();
    expect(
      Object.entries(
        distanceVector({
          nodes: [],
          links: [{ a: 'constructor', b: 'R2', cost: 1 }],
          rounds: 1,
          mode: 'synchronous',
        }).states[1].table.R2,
      ).find(([name]) => name === 'constructor')![1].cost,
    ).toBe(1);
  });
});
describe('Advanced form/storage integration', () => {
  it('keeps new inputs blank and supports new saved scenario tabs', () => {
    for (const tab of ['Tunnelling', 'Distance Vector', 'Frame Relay'] as const) {
      for (const [key, value] of Object.entries(baseValues[tab]!))
        if (key !== 'mode') expect(value).toBe('');
      expect(Object.values(blankRow(tab)).every((v) => v === '')).toBe(true);
      const w = defaults();
      w.saved = [entry(tab, baseValues[tab]!, initialRows(tab), 'Scenario', 'Test')];
      expect(validateWorkspace(JSON.parse(JSON.stringify(w))).saved[0].tab).toBe(tab);
    }
  });
  it('reads row textareas and checkbox state without treating unchecked boxes as passive', () => {
    const elements = [
      { name: 'r-0-networks', type: 'textarea', value: '10.0.0.0/24\n10.1.0.0/24' },
      { name: 'r-0-passive', type: 'checkbox', value: 'on', checked: false },
    ];
    const form = {
      querySelectorAll: () => [{ querySelectorAll: () => elements }],
    } as unknown as HTMLFormElement;
    expect(readRows(form)).toEqual([{ networks: '10.0.0.0/24\n10.1.0.0/24', passive: '' }]);
    elements[1].checked = true;
    expect(readRows(form)[0].passive).toBe('on');
  });
});
