import { host4, token, unicast4 } from './endpoints';
import { integer, ipToInt, overlaps, parseNetwork, requireHost } from './ipv4';
import { interfaceName } from './routing';
export interface DynamicNatInput {
  networks: string[];
  pool: string;
  start: string;
  end: string;
  prefix: string;
  acl: number;
  inside: string;
  outside: string;
  insideAddress?: string;
  outsideAddress?: string;
  nextHop?: string;
}
export function dynamicNat(input: DynamicNatInput) {
  const pool = token(input.pool, 'Pool name'),
    acl = integer(input.acl, 1, 99, 'Standard ACL number');
  const inside = interfaceName(input.inside),
    outside = interfaceName(input.outside);
  if (inside.toLowerCase() === outside.toLowerCase())
    throw new Error('Inside and outside interfaces must differ.');
  const texts = input.networks.filter((x) => x.trim());
  if (!texts.length || texts.length > 128) throw new Error('Enter 1–128 inside networks.');
  const networks = texts.map((x) => parseNetwork(x, true));
  const start = unicast4(input.start, 'Pool start'),
    end = unicast4(input.end, 'Pool end'),
    a = ipToInt(start),
    b = ipToInt(end);
  const poolNet = host4(`${start}/${input.prefix.trim().replace(/^\//, '')}`, 'Pool start');
  requireHost(end, poolNet, 'Pool end');
  if (a > b) throw new Error('Pool start must not exceed pool end.');
  if (networks.some((n) => a <= n.endInt && n.startInt <= b))
    throw new Error('The translated pool must not overlap inside source networks.');
  const warnings: string[] = [];
  if (networks.some((n, i) => networks.slice(i + 1).some((m) => overlaps(n, m))))
    warnings.push('Inside ACL networks overlap; verify that the redundant entries are intended.');
  const lines = [
    'enable',
    'configure terminal',
    `ip nat pool ${pool} ${start} ${end} netmask ${poolNet.mask}`,
    ...networks.map((n) => `access-list ${acl} permit ${n.network} ${n.wildcard}`),
    `ip nat inside source list ${acl} pool ${pool}`,
  ];
  for (const [iface, role, address] of [
    [inside, 'inside', input.insideAddress],
    [outside, 'outside', input.outsideAddress],
  ] as const) {
    lines.push(`interface ${iface}`);
    if (address?.trim()) {
      const n = host4(address, `${role} interface address`);
      if (ipToInt(n.ip) >= a && ipToInt(n.ip) <= b)
        throw new Error(
          'A router interface address cannot be part of the dynamic translation pool.',
        );
      if (
        role === 'inside' &&
        !networks.some((net) => ipToInt(n.ip) >= net.startInt && ipToInt(n.ip) <= net.endInt)
      )
        throw new Error(
          'Inside interface address must belong to a supplied inside source network.',
        );
      lines.push(` ip address ${n.ip} ${n.mask}`);
    }
    lines.push(` ip nat ${role}`, ' no shutdown', 'exit');
  }
  if (input.nextHop?.trim())
    lines.push(`ip route 0.0.0.0 0.0.0.0 ${unicast4(input.nextHop, 'Outside next hop')}`);
  else
    warnings.push(
      'Provide routing toward the outside destination and a return path to the translated pool; NAT does not establish routes.',
    );
  lines.push('end', 'show ip nat translations', 'show ip nat statistics', 'show access-lists');
  return {
    pool,
    acl,
    networks,
    poolNet,
    start,
    end,
    count: b - a + 1,
    inside,
    outside,
    command: lines.join('\n'),
    warnings,
  };
}
