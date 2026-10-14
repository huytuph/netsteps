import { hostsToPrefix, parseNetwork, subnet, HostRequirement, Subnet } from './ipv4';
import { convert, Conversion } from './numbers';
import { planVlsm, Requirement, VlsmPlan } from './vlsm';
import { staticRoute, RouteResult } from './routing';
import { ipv6Address, ipv6Subnet, ipv6StaticRoute, parseIPv6, compressIPv6 } from './ipv6';
export const topics = [
  'Decimal → Binary',
  'Binary → Decimal',
  'Decimal → Hex',
  'Hex → Decimal',
  'Hosts → CIDR',
  'CIDR → Usable hosts',
  'Network address',
  'Broadcast address',
  'Host range',
  'VLSM',
  'Static routing',
  'IPv6 compression',
  'IPv6 expansion',
  'IPv6 address type',
  'IPv6 network prefix',
  'IPv6 prefix capacity',
  'IPv6 static routing',
] as const;
export type Topic = (typeof topics)[number];
export interface Question {
  topic: Topic;
  prompt: string;
  answers: { label: string; value: string }[];
  hints: string[];
  working: string[];
  calculation?:
    | { kind: 'number'; result: Conversion }
    | { kind: 'hosts'; result: HostRequirement }
    | { kind: 'subnet'; result: Subnet }
    | { kind: 'vlsm'; result: VlsmPlan }
    | { kind: 'route'; result: RouteResult }
    | { kind: 'ipv6-address'; result: ReturnType<typeof ipv6Address> }
    | { kind: 'ipv6-subnet'; result: ReturnType<typeof ipv6Subnet> }
    | { kind: 'ipv6-route'; result: ReturnType<typeof ipv6StaticRoute> };
}
export interface CustomQuestion {
  ip: string;
  prefix: string;
  hosts: number;
  requirements: Requirement[];
  nextHop: string;
  exitInterface?: string;
}
export function makeQuestion(topic: Topic, difficulty: string, custom?: CustomQuestion): Question {
  if (!topics.includes(topic)) throw new Error('Choose a supported practice topic.');
  if (topic.startsWith('IPv6')) return makeIPv6Question(topic, difficulty, custom);
  const random = (n: number) => Math.floor(Math.random() * n);
  const octet = difficulty === 'Easy' ? random(32) : random(256);
  const prefix =
    difficulty === 'Easy'
      ? 24 + random(5)
      : difficulty === 'Hard'
        ? 8 + random(23)
        : 16 + random(15);
  const ip = custom?.ip ?? `172.${16 + random(16)}.${random(256)}.${random(256)}`;
  const net = subnet(ip, custom?.prefix ?? prefix);
  const q: Question = { topic, prompt: '', answers: [], hints: [], working: [] };
  if (topics.indexOf(topic) < 4) {
    const [from, to] =
      topic === 'Decimal → Binary'
        ? (['decimal', 'binary'] as const)
        : topic === 'Binary → Decimal'
          ? (['binary', 'decimal'] as const)
          : topic === 'Decimal → Hex'
            ? (['decimal', 'hex'] as const)
            : (['hex', 'decimal'] as const);
    const n = custom ? Number(custom.ip.split('.')[3]) : octet;
    const input = convert(String(n), 'decimal', from).output,
      r = convert(input, from, to);
    q.prompt = `Convert ${input} (${from}) to ${to}.`;
    q.answers = [{ label: to, value: r.output }];
    q.calculation = { kind: 'number', result: r };
    q.hints = [
      `Use base ${to === 'binary' ? 2 : to === 'hex' ? 16 : 10}.`,
      'Write the place values, then fill each position.',
    ];
    q.working = [
      `Decimal value: ${n}`,
      `Binary: ${n.toString(2).padStart(8, '0')}`,
      `Hex: ${n.toString(16).toUpperCase().padStart(2, '0')}`,
    ];
  } else if (topic === 'Hosts → CIDR') {
    const hosts =
      custom?.hosts ??
      (difficulty === 'Easy'
        ? 2 + random(30)
        : difficulty === 'Hard'
          ? 200 + random(8000)
          : 20 + random(200));
    const r = hostsToPrefix(hosts);
    q.prompt = `Find the smallest traditional LAN prefix for ${hosts} usable hosts.`;
    q.answers = [{ label: 'CIDR', value: `/${r.prefix}` }];
    q.calculation = { kind: 'hosts', result: r };
    q.hints = [
      'Reserve the network and broadcast addresses.',
      `Find h such that 2^h − 2 ≥ ${hosts}.`,
    ];
    q.working = [
      `2^${r.hostBits} − 2 = ${r.usable}`,
      `32 − ${r.hostBits} = ${r.prefix}`,
      `Mask: ${r.mask}`,
    ];
  } else if (topic === 'VLSM') {
    const base = parseNetwork(`${net.network}/${net.prefix}`);
    const medium: Requirement[] = [
      { name: 'HQ', hosts: 22, mode: 'lan' as const },
      { name: 'Branch', hosts: 7, mode: 'lan' as const },
      { name: 'Transit', hosts: 2, mode: 'lan' as const },
    ];
    const req =
      custom?.requirements ??
      (difficulty === 'Hard'
        ? [
            { name: 'Campus', hosts: 1000, mode: 'lan' },
            ...medium,
            { name: 'Voice', hosts: 200, mode: 'lan' },
            { name: 'Lab', hosts: 60, mode: 'lan' },
          ]
        : difficulty === 'Easy'
          ? medium.slice(1)
          : medium);
    const baseText = custom
      ? `${base.network}/${base.prefix}`
      : difficulty === 'Hard'
        ? '172.16.0.0/21'
        : '172.16.1.0/24';
    const r = planVlsm(baseText, req);
    q.calculation = { kind: 'vlsm', result: r };
    q.prompt = `Allocate ${baseText} largest first: ${req.map((x) => `${x.name} (${x.hosts} hosts)`).join(', ')}. Enter each network/CIDR.`;
    q.answers = r.allocations.map((a) => ({
      label: a.name,
      value: `${a.subnet.network}/${a.subnet.prefix}`,
    }));
    q.hints = [
      'Size every LAN with 2^h − 2.',
      'Allocate largest first on aligned subnet boundaries.',
    ];
    q.working = r.allocations.map(
      (a) =>
        `${a.name}: ${a.hosts} hosts → /${a.subnet.prefix} → ${a.subnet.network}/${a.subnet.prefix}`,
    );
  } else if (topic === 'Static routing') {
    const hop = custom?.nextHop ?? '172.16.255.2';
    const dest = custom
      ? `${net.network}/${net.prefix}`
      : difficulty === 'Hard'
        ? '172.16.32.0/19'
        : difficulty === 'Medium'
          ? '172.16.2.128/27'
          : '172.16.2.0/24';
    const r = staticRoute({
      destination: dest,
      nextHop: hop,
      exitInterface: '',
      distance: 1,
      connected: [],
      floating: false,
      primaryDistance: 1,
    });
    q.prompt = `Write a Cisco static route to ${dest} via ${hop}.`;
    q.answers = [{ label: 'Command', value: r.command }];
    q.calculation = { kind: 'route', result: r };
    q.hints = [
      'Syntax: ip route destination mask next-hop.',
      'Convert the destination prefix to a dotted mask.',
    ];
    q.working = [
      `Destination: ${r.destination.network}`,
      `Mask: ${r.destination.mask}`,
      `Next hop: ${hop}`,
      r.command,
    ];
  } else {
    q.calculation = { kind: 'subnet', result: net };
    q.prompt =
      topic === 'CIDR → Usable hosts'
        ? `How many usable hosts are in /${net.prefix}?`
        : `Find the ${topic.toLowerCase()} for ${ip}/${net.prefix}.`;
    q.answers =
      topic === 'Network address'
        ? [{ label: 'Network', value: net.network }]
        : topic === 'Broadcast address'
          ? [{ label: 'Broadcast', value: net.broadcast || 'none' }]
          : topic === 'Host range'
            ? [
                { label: 'First host', value: net.first },
                { label: 'Last host', value: net.last },
              ]
            : [{ label: 'Usable hosts', value: String(net.usable) }];
    q.hints = [
      `Host bits = 32 − ${net.prefix}.`,
      'Find the network boundary, then the last address in that block.',
    ];
    q.working = [
      `Mask: ${net.mask}`,
      `Block contains ${net.size} addresses.`,
      `Network: ${net.network}`,
      `Broadcast: ${net.broadcast || 'none (/31 or /32)'}`,
      `Usable: ${net.first}–${net.last} (${net.usable})`,
    ];
  }
  return q;
}
export function checkAnswer(given: string, expected: string, topic: Topic): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (topic.startsWith('IPv6')) {
    try {
      if (topic === 'IPv6 compression') return given.trim() === expected;
      if (topic === 'IPv6 expansion')
        return (
          /^[\da-f]{4}(:[\da-f]{4}){7}$/i.test(given.trim()) &&
          parseIPv6(given) === parseIPv6(expected)
        );
      if (topic === 'IPv6 network prefix') {
        const parts = given.trim().split('/'),
          answer = expected.split('/');
        return (
          parts.length === 2 &&
          /^\d{1,3}$/.test(parts[1]) &&
          Number(parts[1]) === Number(answer[1]) &&
          parseIPv6(parts[0]) === parseIPv6(answer[0])
        );
      }
      if (topic === 'IPv6 static routing') {
        const canonical = (text: string) =>
          normalize(text)
            .split(' ')
            .map((token) => {
              if (!token.includes(':')) return token;
              const [ip, prefix, ...rest] = token.split('/');
              if (rest.length || (prefix !== undefined && !/^\d{1,3}$/.test(prefix)))
                throw new Error('Invalid route prefix');
              return (
                compressIPv6(parseIPv6(ip)) + (prefix === undefined ? '' : '/' + Number(prefix))
              );
            })
            .join(' ');
        return canonical(given) === canonical(expected);
      }
    } catch {
      return false;
    }
  }
  if (topic === 'Hosts → CIDR')
    return normalize(given).replace(/^\//, '') === expected.replace(/^\//, '');
  if (topic === 'Decimal → Binary')
    return /^[01]{1,8}$/.test(given.trim()) && parseInt(given, 2) === parseInt(expected, 2);
  if (topic === 'Decimal → Hex')
    return (
      /^(0x)?[\da-f]{1,2}$/i.test(given.trim()) &&
      parseInt(given.replace(/^0x/i, ''), 16) === parseInt(expected, 16)
    );
  return normalize(given) === normalize(expected);
}

function makeIPv6Question(topic: Topic, difficulty: string, custom?: CustomQuestion): Question {
  const random = (n: number) => Math.floor(Math.random() * n);
  const special = [
    '::',
    '::1',
    'fe80::1',
    'fd12:3456::1',
    'ff02::1',
    '2001:db8::1',
    '2001:4860::1',
  ];
  const ip =
    custom?.ip ||
    (topic === 'IPv6 address type'
      ? special[random(special.length)]
      : difficulty === 'Easy'
        ? `2001:db8:${random(65536).toString(16)}::${(random(255) + 1).toString(16)}`
        : difficulty === 'Hard'
          ? `2001:db8:0:${random(65536).toString(16)}:0:0:${random(65536).toString(16)}:1`
          : `2001:db8:0:0:${random(65536).toString(16)}:0:0:1`);
  if (custom && !custom.ip.trim()) throw new Error('Enter a custom IPv6 address.');
  const r = ipv6Address(ip);
  const q: Question = {
    topic,
    prompt: '',
    answers: [],
    hints: [],
    working: [],
    calculation: { kind: 'ipv6-address', result: r },
  };
  if (topic === 'IPv6 compression') {
    q.prompt = `Compress ${r.expanded} using the canonical lowercase format.`;
    q.answers = [{ label: 'Compressed IPv6', value: r.compressed }];
    q.hints = [
      'Remove leading zeros from each hextet.',
      'Use :: once for the longest run of at least two zero hextets; choose the leftmost run on a tie.',
    ];
  } else if (topic === 'IPv6 expansion') {
    q.prompt = `Expand ${r.compressed} to eight four-digit hextets.`;
    q.answers = [{ label: 'Expanded IPv6', value: r.expanded }];
    q.hints = [
      'Count the visible hextets; :: fills the difference from eight.',
      'Pad every hextet to four hexadecimal digits.',
    ];
  } else if (topic === 'IPv6 address type') {
    q.prompt = `Classify ${r.compressed}. Use one label: Unspecified, Loopback, Link-local unicast, Unique-local unicast, Multicast, Documentation, Global unicast space, IPv4-mapped, Deprecated site-local, Other / special-purpose space.`;
    q.answers = [{ label: 'Address type', value: r.type }];
    q.hints = [
      'Check :: and ::1 first, then inspect the high-order prefix bits.',
      'fe80::/10 is link-local; fc00::/7 is unique-local; ff00::/8 is multicast.',
    ];
  } else {
    const prefix = custom
      ? custom.prefix
      : difficulty === 'Easy'
        ? '64'
        : difficulty === 'Hard'
          ? String([0, 47, 63, 65, 73, 127, 128][random(7)])
          : String([48, 56, 60, 64][random(4)]);
    const n = ipv6Subnet(ip, prefix);
    q.calculation = { kind: 'ipv6-subnet', result: n };
    if (topic === 'IPv6 network prefix') {
      q.prompt = `Find the normalized network/prefix for ${r.compressed}/${n.prefix}.`;
      q.answers = [{ label: 'IPv6 network / prefix', value: `${n.network}/${n.prefix}` }];
      q.hints = [
        `Keep the first ${n.prefix} bits.`,
        `Clear the last ${n.hostBits} bits; a boundary may cut through a hextet.`,
      ];
    } else if (topic === 'IPv6 prefix capacity') {
      q.prompt = `How many total address bit patterns are in /${n.prefix}? Enter the exact decimal integer.`;
      q.answers = [{ label: 'Total addresses', value: String(n.size) }];
      q.hints = [
        `128 − ${n.prefix} = ${n.hostBits} remaining bits.`,
        'Use 2^(remaining bits). IPv6 has no broadcast; do not subtract two.',
      ];
    } else {
      const hop = custom ? custom.nextHop : difficulty === 'Hard' ? 'fe80::2' : '2001:db8:ffff::2';
      const exit = custom
        ? custom.exitInterface || ''
        : difficulty === 'Hard'
          ? 'GigabitEthernet0/0'
          : '';
      const route = ipv6StaticRoute({
        destination: `${n.network}/${n.prefix}`,
        nextHop: hop,
        exitInterface: exit,
        distance: 1,
        connected: [],
        floating: false,
        primaryDistance: 0,
      });
      q.calculation = { kind: 'ipv6-route', result: route };
      q.prompt = `Write a Cisco IPv6 static route to ${n.network}/${n.prefix} via ${route.nextHop}${exit ? ' on ' + exit : ''} (distance 1, omit the distance suffix).`;
      q.answers = [{ label: 'IPv6 route command', value: route.command }];
      q.hints = [
        'Syntax: ipv6 route destination/prefix [exit-interface] next-hop.',
        'A link-local next hop needs the exit interface. IPv6 uses a prefix length, not a dotted mask.',
      ];
    }
  }
  q.working = [`Expanded: ${r.expanded}`, `Compressed: ${r.compressed}`, `Type: ${r.type}`, r.note];
  return q;
}
