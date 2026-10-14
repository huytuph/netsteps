import { integer, ipToInt } from './ipv4';
import { interfaceName, RouteInput } from './routing';

export const IPV6_MAX = (1n << 128n) - 1n;
export function parseIPv6(input: string): bigint {
  let text = input.trim();
  if (!text || /[\s%/\[\]]/.test(text))
    throw new Error(
      'Enter an IPv6 address without a prefix, brackets or zone ID. Supply the exit interface separately for routes.',
    );
  if (text.includes('.')) {
    const pos = text.lastIndexOf(':');
    if (pos < 0) throw new Error('IPv6 needs colon-separated hextets.');
    const tail = ipToInt(text.slice(pos + 1));
    text =
      text.slice(0, pos + 1) +
      Math.floor(tail / 65536).toString(16) +
      ':' +
      (tail % 65536).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) throw new Error('Use :: at most once in an IPv6 address.');
  const groups = (part: string) => (part ? part.split(':') : []);
  const left = groups(halves[0]),
    right = halves.length === 2 ? groups(halves[1]) : [];
  if ([...left, ...right].some((x) => !/^[0-9a-f]{1,4}$/i.test(x)))
    throw new Error('Each IPv6 hextet must contain 1–4 hexadecimal digits.');
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1)
    throw new Error('IPv6 must expand to exactly eight hextets; :: must replace at least one.');
  const all = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  return all.reduce((n, h) => (n << 16n) | BigInt('0x' + h), 0n);
}
export function hextets(value: bigint): string[] {
  if (value < 0n || value > IPV6_MAX) throw new Error('IPv6 value must fit in 128 bits.');
  return value.toString(16).padStart(32, '0').match(/.{4}/g)!;
}
export function expandIPv6(value: bigint | string): string {
  return hextets(typeof value === 'string' ? parseIPv6(value) : value).join(':');
}
export function compressIPv6(value: bigint | string): string {
  const groups = hextets(typeof value === 'string' ? parseIPv6(value) : value).map((h) =>
    parseInt(h, 16).toString(16),
  );
  let bestStart = -1,
    bestLength = 1;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== '0') {
      i++;
      continue;
    }
    const start = i;
    while (i < groups.length && groups[i] === '0') i++;
    if (i - start > bestLength) {
      bestStart = start;
      bestLength = i - start;
    }
  }
  if (bestStart < 0) return groups.join(':');
  return (
    groups.slice(0, bestStart).join(':') + '::' + groups.slice(bestStart + bestLength).join(':')
  );
}
export function binaryIPv6(value: bigint): string {
  return hextets(value)
    .map((h) => parseInt(h, 16).toString(2).padStart(16, '0'))
    .join(':');
}
export function parseBinaryIPv6(input: string): bigint {
  const text = input.trim();
  const bits = text.includes(':') ? text.split(':') : [];
  if (
    bits.length
      ? bits.length !== 8 || bits.some((h) => !/^[01]{16}$/.test(h))
      : !/^[01]{128}$/.test(text)
  )
    throw new Error('Enter 128 binary bits, or eight colon-separated groups of exactly 16 bits.');
  return BigInt('0b' + (bits.length ? bits.join('') : text));
}
export function ipv6Prefix(input: string | number): number {
  const text = String(input).trim().replace(/^\//, '');
  if (!/^\d{1,3}$/.test(text)) throw new Error('Enter an IPv6 prefix from /0 to /128.');
  return integer(Number(text), 0, 128, 'IPv6 prefix');
}
export function ipv6Type(value: bigint): { type: string; note: string } {
  const within = (base: string, prefix: number) =>
    value >> BigInt(128 - prefix) === parseIPv6(base) >> BigInt(128 - prefix);
  if (value === 0n)
    return {
      type: 'Unspecified',
      note: ':: means no address; it cannot identify a next-hop router.',
    };
  if (value === 1n)
    return { type: 'Loopback', note: '::1 refers to this node and stays on this node.' };
  if (within('::ffff:0:0', 96))
    return {
      type: 'IPv4-mapped',
      note: 'Embeds an IPv4 address for software APIs; this is not an ordinary IPv6 next hop.',
    };
  if (within('ff00::', 8)) {
    const scope = Number((value >> 112n) & 15n);
    const names: Record<number, string> = {
      1: 'interface-local',
      2: 'link-local',
      3: 'realm-local',
      4: 'admin-local',
      5: 'site-local',
      8: 'organization-local',
      14: 'global',
    };
    return {
      type: 'Multicast',
      note: `ff00::/8 identifies groups. Scope ${scope}: ${names[scope] || 'reserved or unassigned'}. IPv6 has no broadcast.`,
    };
  }
  if (within('fe80::', 10))
    return {
      type: 'Link-local unicast',
      note: 'fe80::/10 is link-local scope; standard link-local addresses use fe80::/64 with the next 54 bits zero. Routers do not forward these beyond the link. A static next hop needs an exit interface.',
    };
  if (within('fc00::', 7))
    return {
      type: 'Unique-local unicast',
      note: 'fc00::/7 is unique-local space; locally assigned prefixes use fd00::/8. These addresses are not intended for global Internet routing.',
    };
  if (within('fec0::', 10))
    return {
      type: 'Deprecated site-local',
      note: 'fec0::/10 site-local addressing is deprecated; use appropriate unique-local or global addresses.',
    };
  if (within('2001:db8::', 32))
    return {
      type: 'Documentation',
      note: '2001:db8::/32 is for examples and labs, not public Internet routing.',
    };
  if (within('2000::', 3))
    return {
      type: 'Global unicast space',
      note: 'Within 2000::/3. Special-purpose allocations exist; the bit pattern alone does not prove assignment or reachability.',
    };
  return {
    type: 'Other / special-purpose space',
    note: 'Check the relevant IPv6 allocation before assigning this address. Anycast cannot be distinguished from unicast from its text alone.',
  };
}
export function ipv6Address(input: string) {
  const value = parseIPv6(input),
    expanded = expandIPv6(value),
    compressed = compressIPv6(value);
  const classification = ipv6Type(value);
  const unicast = value > 1n && value >> 120n !== 255n && classification.type !== 'IPv4-mapped';
  return {
    value,
    expanded,
    compressed,
    binary: binaryIPv6(value),
    ...classification,
    solicitedNode: unicast ? compressIPv6(parseIPv6('ff02::1:ff00:0') | (value & 0xffffffn)) : null,
  };
}
export interface IPv6Subnet {
  ip: string;
  prefix: number;
  network: string;
  last: string;
  start: bigint;
  end: bigint;
  size: bigint;
  hostBits: number;
  mask: bigint;
  previous: string | null;
  next: string | null;
}
export function ipv6Subnet(address: string, prefix: string | number): IPv6Subnet {
  const value = parseIPv6(address),
    p = ipv6Prefix(prefix),
    hostBits = 128 - p;
  const size = 1n << BigInt(hostBits),
    mask = IPV6_MAX ^ (size - 1n),
    start = value & mask,
    end = start + size - 1n;
  return {
    ip: compressIPv6(value),
    prefix: p,
    network: compressIPv6(start),
    last: compressIPv6(end),
    start,
    end,
    size,
    hostBits,
    mask,
    previous: start >= size ? `${compressIPv6(start - size)}/${p}` : null,
    next: end < IPV6_MAX ? `${compressIPv6(end + 1n)}/${p}` : null,
  };
}
export function parseIPv6Network(input: string, aligned = false): IPv6Subnet {
  const parts = input.trim().split('/');
  if (parts.length !== 2)
    throw new Error('Enter an IPv6 network and prefix, such as 2001:db8::/48.');
  const net = ipv6Subnet(parts[0], parts[1]);
  if (aligned && parseIPv6(parts[0]) !== net.start)
    throw new Error(`Use the aligned network ${net.network}/${net.prefix}.`);
  return net;
}
export function ipv6Overlaps(a: IPv6Subnet, b: IPv6Subnet): boolean {
  return a.start <= b.end && b.start <= a.end;
}
export function ipv6OverlapCheck(inputs: string[]) {
  if (inputs.length < 2 || inputs.length > 256)
    throw new Error('Enter 2–256 IPv6 networks to compare.');
  const networks = inputs.map((x) => parseIPv6Network(x));
  const conflicts: string[] = [];
  networks.forEach((a, i) =>
    networks.slice(i + 1).forEach((b) => {
      if (ipv6Overlaps(a, b))
        conflicts.push(`${a.network}/${a.prefix} overlaps ${b.network}/${b.prefix}.`);
    }),
  );
  return { networks, conflicts };
}
export interface IPv6Requirement {
  name: string;
  prefix: string;
  locked?: string;
}
export function planIPv6(baseText: string, requirements: IPv6Requirement[], largestFirst = true) {
  const base = parseIPv6Network(baseText, true);
  if (!requirements.length || requirements.length > 256)
    throw new Error('Add 1–256 IPv6 subnet requirements.');
  const names = new Set<string>();
  const items = requirements.map((r, index) => {
    const name = r.name.trim(),
      prefix = ipv6Prefix(r.prefix);
    if (!name || names.has(name.toLowerCase()))
      throw new Error('Give each subnet a unique, nonempty name.');
    names.add(name.toLowerCase());
    if (prefix < base.prefix)
      throw new Error(`${name}: subnet prefix must be at least /${base.prefix}.`);
    const size = 1n << BigInt(128 - prefix);
    const locked = r.locked?.trim() ? parseIPv6Network(r.locked, true) : null;
    if (locked && (locked.prefix !== prefix || locked.start < base.start || locked.end > base.end))
      throw new Error(
        `${name}: locked subnet must match its requested prefix and fit inside the base.`,
      );
    return { name, prefix, size, locked, index };
  });
  const allocations: { name: string; subnet: IPv6Subnet; locked: boolean; index: number }[] = [];
  for (const item of items.filter((x) => x.locked)) {
    if (allocations.some((a) => ipv6Overlaps(a.subnet, item.locked!)))
      throw new Error('Locked IPv6 subnets overlap.');
    allocations.push({ name: item.name, subnet: item.locked!, locked: true, index: item.index });
  }
  const unlocked = items.filter((x) => !x.locked);
  if (largestFirst) unlocked.sort((a, b) => a.prefix - b.prefix || a.index - b.index);
  for (const item of unlocked) {
    let start = base.start;
    for (const used of [...allocations].sort((a, b) =>
      a.subnet.start < b.subnet.start ? -1 : 1,
    )) {
      start = ((start + item.size - 1n) / item.size) * item.size;
      if (start + item.size - 1n < used.subnet.start) break;
      if (start <= used.subnet.end) start = used.subnet.end + 1n;
    }
    start = ((start + item.size - 1n) / item.size) * item.size;
    if (start + item.size - 1n > base.end)
      throw new Error(`${item.name}: insufficient aligned space in the base network.`);
    allocations.push({
      name: item.name,
      subnet: ipv6Subnet(compressIPv6(start), item.prefix),
      locked: false,
      index: item.index,
    });
  }
  const free: { first: string; last: string; size: bigint }[] = [];
  let cursor = base.start;
  for (const a of [...allocations].sort((a, b) => (a.subnet.start < b.subnet.start ? -1 : 1))) {
    if (a.subnet.start > cursor)
      free.push({
        first: compressIPv6(cursor),
        last: compressIPv6(a.subnet.start - 1n),
        size: a.subnet.start - cursor,
      });
    cursor = a.subnet.end + 1n;
  }
  if (cursor <= base.end)
    free.push({ first: compressIPv6(cursor), last: base.last, size: base.end - cursor + 1n });
  return { base, allocations, free, remaining: free.reduce((n, r) => n + r.size, 0n) };
}
export function ipv6StaticRoute(input: RouteInput) {
  const destination = parseIPv6Network(input.destination),
    warnings: string[] = [];
  const distance = integer(input.distance, 1, 254, 'Administrative distance');
  if (
    input.floating &&
    distance <= integer(input.primaryDistance, 1, 254, 'Primary route distance')
  )
    throw new Error('A floating route must have a greater distance than the primary route.');
  const connected = input.connected.filter((x) => x.trim()).map((x) => parseIPv6Network(x));
  const exit = input.exitInterface.trim() ? interfaceName(input.exitInterface) : '';
  if (!exit && !input.nextHop.trim())
    throw new Error('Provide an IPv6 next hop or exit interface.');
  let nextHop = '';
  if (input.nextHop.trim()) {
    const value = parseIPv6(input.nextHop),
      type = ipv6Type(value);
    if (value <= 1n || value >> 120n === 255n || type.type === 'IPv4-mapped')
      throw new Error(
        'IPv6 next hop must be unicast, not unspecified, loopback, multicast or IPv4-mapped.',
      );
    if (input.localAddress?.trim() && parseIPv6(input.localAddress) === value)
      throw new Error('Next hop cannot be the local router address.');
    if (type.type === 'Link-local unicast' && !exit)
      throw new Error('A link-local next hop requires an exit interface.');
    nextHop = compressIPv6(value);
    if (type.type === 'Link-local unicast')
      warnings.push(
        'Verify that this link-local neighbor is on the specified exit interface; a prefix alone cannot identify its link.',
      );
    else if (!connected.some((n) => value >= n.start && value <= n.end))
      warnings.push(
        'Next hop is not in a supplied connected network. Verify recursive reachability.',
      );
  } else
    warnings.push(
      'An interface-only route is suitable for point-to-point links. On multi-access Ethernet, supply a next hop.',
    );
  if (destination.ip !== destination.network)
    warnings.push(`Destination normalized to ${destination.network}/${destination.prefix}.`);
  if (connected.some((n) => n.start === destination.start && n.prefix === destination.prefix))
    warnings.push(
      'This destination is already directly connected; a static route is usually unnecessary.',
    );
  else if (destination.prefix !== 0 && connected.some((n) => ipv6Overlaps(n, destination)))
    warnings.push(
      'Destination overlaps a connected prefix. Verify that a more-specific route is intended.',
    );
  const command = [
    'ipv6 route',
    `${destination.network}/${destination.prefix}`,
    exit,
    nextHop,
    distance === 1 ? '' : String(distance),
  ]
    .filter(Boolean)
    .join(' ');
  return { destination, nextHop, exit, distance, connected, warnings, command };
}
