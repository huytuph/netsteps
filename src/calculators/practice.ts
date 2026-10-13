import { hostsToPrefix, parseNetwork, subnet, HostRequirement, Subnet } from './ipv4';
import { convert, Conversion } from './numbers';
import { planVlsm, Requirement, VlsmPlan } from './vlsm';
import { staticRoute, RouteResult } from './routing';
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
    | { kind: 'route'; result: RouteResult };
}
export interface CustomQuestion {
  ip: string;
  prefix: string;
  hosts: number;
  requirements: Requirement[];
  nextHop: string;
}
export function makeQuestion(topic: Topic, difficulty: string, custom?: CustomQuestion): Question {
  if (!topics.includes(topic)) throw new Error('Choose a supported practice topic.');
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
