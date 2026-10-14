import { integer, ipToInt, intToIp, parseNetwork, requireHost, overlaps, Subnet } from './ipv4';
import { interfaceName } from './routing';
import { ipv6Type, parseIPv6, parseIPv6Network, compressIPv6, ipv6Overlaps } from './ipv6';

function token(input: string, label: string): string {
  const v = input.trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v))
    throw new Error(
      `${label}: use a name starting with a letter, followed by letters, digits, - or _.`,
    );
  return v;
}
function unicast4(input: string, label: string): string {
  const n = ipToInt(input);
  if (n === 0 || Math.floor(n / 2 ** 24) === 127 || n >= 0xe0000000)
    throw new Error(`${label} must be a unicast IPv4 address.`);
  return intToIp(n);
}
function host4(input: string, label: string): Subnet {
  const n = parseNetwork(input);
  unicast4(n.ip, label);
  requireHost(n.ip, n, label);
  return n;
}
function host6(input: string, label: string) {
  const n = parseIPv6Network(input),
    value = parseIPv6(n.ip),
    type = ipv6Type(value).type;
  if (
    value <= 1n ||
    value >> 120n === 255n ||
    type === 'IPv4-mapped' ||
    type === 'Link-local unicast'
  )
    throw new Error(
      `${label}: enter a global/unique-local IPv6 interface address and prefix, not a link-local or special endpoint.`,
    );
  return n;
}
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

export interface TunnelEndpoint {
  name: string;
  wanInterface: string;
  wanAddress: string;
  tunnelAddress: string;
  lanInterface: string;
  lanAddress: string;
  underlayNextHop?: string;
}
export interface TunnelInput {
  mode: 'ipv6ip' | 'gre4' | 'gre6';
  id: number;
  a: TunnelEndpoint;
  b: TunnelEndpoint;
}
export function tunnelPlan(input: TunnelInput) {
  if (!['ipv6ip', 'gre4', 'gre6'].includes(input.mode))
    throw new Error('Choose a supported tunnel mode.');
  const id = integer(input.id, 0, 65535, 'Tunnel number'),
    v6 = input.mode !== 'gre4';
  const endpoints = [input.a, input.b].map((e) => {
    const name = token(e.name, 'Router name'),
      wanInterface = interfaceName(e.wanInterface),
      lanInterface = interfaceName(e.lanInterface);
    if (wanInterface.toLowerCase() === lanInterface.toLowerCase())
      throw new Error(`${name}: LAN and WAN interfaces must differ.`);
    if (/^tunnel/i.test(wanInterface) || /^tunnel/i.test(lanInterface))
      throw new Error('LAN/WAN must be physical interfaces, not the tunnel being created.');
    const wan = host4(e.wanAddress, 'WAN endpoint');
    const tunnel = v6
      ? host6(e.tunnelAddress, 'Tunnel address')
      : host4(e.tunnelAddress, 'Tunnel address');
    const lan = v6 ? host6(e.lanAddress, 'LAN address') : host4(e.lanAddress, 'LAN address');
    return {
      name,
      wanInterface,
      lanInterface,
      wan,
      tunnel,
      lan,
      nextHop: e.underlayNextHop?.trim() ? unicast4(e.underlayNextHop, 'Underlay next hop') : '',
    };
  });
  const [a, b] = endpoints;
  if (a.name.toLowerCase() === b.name.toLowerCase() || a.wan.ip === b.wan.ip)
    throw new Error('Use two distinct router names and WAN endpoint addresses.');
  if (
    a.tunnel.network !== b.tunnel.network ||
    a.tunnel.prefix !== b.tunnel.prefix ||
    a.tunnel.ip === b.tunnel.ip
  )
    throw new Error(
      'Tunnel endpoints must be distinct addresses in the same tunnel subnet and prefix.',
    );
  const warnings = [
    'Both outer IPv4 endpoints must be reachable through the underlay before the tunnel can carry traffic. Generated commands are a plan, not a live connectivity test.',
  ];
  if (v6) {
    const aa = host6(input.a.lanAddress, 'LAN A'),
      bb = host6(input.b.lanAddress, 'LAN B'),
      t = host6(input.a.tunnelAddress, 'Tunnel');
    if (ipv6Overlaps(aa, bb) || ipv6Overlaps(aa, t) || ipv6Overlaps(bb, t))
      throw new Error('LANs and the tunnel must use disjoint prefixes.');
  } else {
    const nets = [
      host4(input.a.lanAddress, 'LAN A'),
      host4(input.b.lanAddress, 'LAN B'),
      host4(input.a.tunnelAddress, 'Tunnel'),
    ];
    if (
      nets.some((n, i) => nets.slice(i + 1).some((m) => overlaps(n, m))) ||
      nets.some((n) => [a.wan, b.wan].some((w) => overlaps(n, w)))
    )
      throw new Error(
        'Inner LAN/tunnel networks must be disjoint and separate from the outer IPv4 networks.',
      );
  }
  const blocks = endpoints.map((e, i) => {
    const remote = endpoints[1 - i],
      lines = [
        `! ${e.name}`,
        'enable',
        'configure terminal',
        `hostname ${e.name}`,
        ...(v6 ? ['ipv6 unicast-routing'] : []),
        `interface ${e.wanInterface}`,
        ` ip address ${e.wan.ip} ${(e.wan as Subnet).mask}`,
        ' no shutdown',
        'exit',
      ];
    if (e.nextHop) {
      const hop = ipToInt(e.nextHop),
        wan = e.wan;
      if (hop === ipToInt(wan.ip))
        throw new Error('Underlay next hop cannot be the local WAN address.');
      requireHost(e.nextHop, wan, 'Underlay next hop');
      lines.push(`ip route ${remote.wan.ip} 255.255.255.255 ${e.nextHop}`);
    } else if (ipToInt(remote.wan.ip) < e.wan.startInt || ipToInt(remote.wan.ip) > e.wan.endInt)
      warnings.push(
        `${e.name}: supply existing underlay routing or enter a next hop toward ${remote.wan.ip}.`,
      );
    lines.push(
      `interface ${e.lanInterface}`,
      v6
        ? ` ipv6 address ${e.lan.ip}/${e.lan.prefix}`
        : ` ip address ${e.lan.ip} ${(e.lan as Subnet).mask}`,
      ' no shutdown',
      'exit',
      `interface Tunnel${id}`,
    );
    if (v6) lines.push(' no ip address', ` ipv6 address ${e.tunnel.ip}/${e.tunnel.prefix}`);
    else lines.push(` ip address ${e.tunnel.ip} ${(e.tunnel as Subnet).mask}`);
    lines.push(
      ` tunnel source ${e.wanInterface}`,
      ` tunnel destination ${remote.wan.ip}`,
      ` tunnel mode ${input.mode === 'ipv6ip' ? 'ipv6ip' : 'gre ip'}`,
      ' no shutdown',
      'exit',
      v6
        ? `ipv6 route ${remote.lan.network}/${remote.lan.prefix} ${remote.tunnel.ip}`
        : `ip route ${remote.lan.network} ${(remote.lan as Subnet).mask} ${remote.tunnel.ip}`,
      'end',
      `show interfaces Tunnel${id}`,
      v6 ? 'show ipv6 route' : 'show ip route',
    );
    return lines.join('\n');
  });
  return { mode: input.mode, id, endpoints, command: blocks.join('\n\n'), warnings };
}

export interface FrameCircuit {
  suffix: number;
  dlci: number;
  address: string;
  peer: string;
  remoteNetworks: string[];
}
export function frameRelayPlan(
  routerText: string,
  parentText: string,
  circuits: FrameCircuit[],
  lanInterfaceText = '',
  lanAddressText = '',
) {
  const router = token(routerText, 'Router name'),
    parent = interfaceName(parentText);
  if (!/^(serial|se|s)\d[\d/]*$/i.test(parent))
    throw new Error('Use a physical serial parent interface such as Serial0/0/0.');
  if (!circuits.length || circuits.length > 64) throw new Error('Add 1–64 Frame Relay circuits.');
  const suffixes = new Set<number>(),
    dlcis = new Set<number>(),
    networks: Subnet[] = [],
    destinations = new Set<string>();
  const lines = [`! ${router}`, 'enable', 'configure terminal', `hostname ${router}`];
  let lan: Subnet | null = null;
  if (lanInterfaceText.trim() || lanAddressText.trim()) {
    const iface = interfaceName(lanInterfaceText);
    lan = host4(lanAddressText, 'LAN address');
    if (iface.toLowerCase() === parent.toLowerCase())
      throw new Error('LAN and serial parent interfaces must differ.');
    lines.push(`interface ${iface}`, ` ip address ${lan.ip} ${lan.mask}`, ' no shutdown', 'exit');
  }
  lines.push(
    `interface ${parent}`,
    ' no ip address',
    ' encapsulation frame-relay',
    ' no shutdown',
    'exit',
  );
  const allocations = circuits.map((c) => {
    const suffix = integer(c.suffix, 1, 4294967295, 'Subinterface number'),
      dlci = integer(c.dlci, 16, 1007, 'DLCI');
    if (suffixes.has(suffix) || dlcis.has(dlci))
      throw new Error('Subinterface numbers and local DLCIs must be unique on this parent.');
    suffixes.add(suffix);
    dlcis.add(dlci);
    const net = host4(c.address, 'Subinterface address'),
      peer = unicast4(c.peer, 'Remote peer');
    requireHost(peer, net, 'Remote peer');
    if (peer === net.ip)
      throw new Error('Remote peer cannot equal the local subinterface address.');
    if (networks.some((n) => overlaps(n, net)) || (lan && overlaps(lan, net)))
      throw new Error('Frame Relay circuits and the local LAN must use disjoint subnets.');
    networks.push(net);
    const remote = c.remoteNetworks.filter((x) => x.trim()).map((x) => parseNetwork(x, true));
    if (!remote.length)
      throw new Error('Supply at least one remote LAN per circuit to generate its static routes.');
    for (const dest of remote) {
      const key = `${dest.network}/${dest.prefix}`;
      if (destinations.has(key))
        throw new Error('A remote destination is duplicated; enter its intended circuit once.');
      destinations.add(key);
    }
    lines.push(
      `interface ${parent}.${suffix} point-to-point`,
      ` ip address ${net.ip} ${net.mask}`,
      ` frame-relay interface-dlci ${dlci}`,
      ' no shutdown',
      'exit',
    );
    return { suffix, dlci, net, peer, remote };
  });
  for (const a of allocations)
    for (const n of a.remote) {
      if (networks.some((link) => overlaps(n, link)) || (lan && overlaps(lan, n)))
        throw new Error('Remote LAN routes must not overlap local circuit or LAN subnets.');
      lines.push(`ip route ${n.network} ${n.mask} ${a.peer}`);
    }
  lines.push('end', 'show frame-relay pvc', 'show frame-relay map', 'show ip route');
  return {
    router,
    parent,
    allocations,
    command: lines.join('\n'),
    warnings: [
      'DLCIs are local to each physical link; the remote DLCI may differ. Configure the Frame Relay cloud/PVC mapping and the remote router separately.',
      'This planner generates numbered point-to-point subinterfaces, not multipoint mappings. Confirm encapsulation/LMI and return routes in your topology.',
    ],
  };
}

export interface OspfInterface {
  router: string;
  routerId: string;
  iface: string;
  address: string;
  area: string;
  passive: boolean;
}
export function ospfv3Plan(processId: number, inputs: OspfInterface[]) {
  const process = integer(processId, 1, 65535, 'OSPF process ID');
  if (!inputs.length || inputs.length > 128) throw new Error('Add 1–128 OSPF interface rows.');
  const routers = new Map<string, { name: string; id: string; rows: OspfInterface[] }>(),
    ids = new Map<string, string>(),
    seen = new Set<string>(),
    addresses = new Set<string>();
  const interfaces = inputs.map((r) => {
    const router = token(r.router, 'Router name'),
      key = router.toLowerCase(),
      id = intToIp(ipToInt(r.routerId)),
      iface = interfaceName(r.iface),
      address = host6(r.address, 'OSPF interface address');
    if (ipToInt(id) === 0) throw new Error('Use a nonzero OSPF router ID.');
    const area = r.area.trim();
    if (!area || (!/^\d{1,10}$/.test(area) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(area)))
      throw new Error('Enter an OSPF area as a 32-bit decimal number or dotted ID.');
    const areaNumber = area.includes('.')
      ? ipToInt(area)
      : integer(Number(area), 0, 4294967295, 'OSPF area');
    const existing = routers.get(key);
    if (existing && existing.id !== id)
      throw new Error(`${router}: router ID must be consistent across interface rows.`);
    if (ids.has(id) && ids.get(id) !== key)
      throw new Error('Every OSPF router needs a unique router ID.');
    ids.set(id, key);
    if (seen.has(`${key}:${iface.toLowerCase()}`))
      throw new Error('Each router/interface pair must appear only once.');
    if (addresses.has(address.ip))
      throw new Error('OSPF interface addresses must be unique across routers.');
    seen.add(`${key}:${iface.toLowerCase()}`);
    addresses.add(address.ip);
    const row = {
      router,
      routerId: id,
      iface,
      address: `${address.ip}/${address.prefix}`,
      area: String(areaNumber),
      passive: r.passive,
    };
    if (existing) existing.rows.push(row);
    else routers.set(key, { name: router, id, rows: [row] });
    return { ...row, net: address };
  });
  const warnings: string[] = [];
  interfaces.forEach((a, i) =>
    interfaces.slice(i + 1).forEach((b) => {
      if (a.router.toLowerCase() === b.router.toLowerCase() && ipv6Overlaps(a.net, b.net))
        throw new Error(
          'Two interfaces on the same router must not have overlapping IPv6 prefixes.',
        );
      if (a.net.network === b.net.network && a.net.prefix === b.net.prefix && a.area !== b.area)
        warnings.push(
          `${a.router} and ${b.router}: shared prefix has different OSPF area IDs; adjacency will not form.`,
        );
      if (
        a.net.network === b.net.network &&
        a.net.prefix === b.net.prefix &&
        (a.passive || b.passive)
      )
        warnings.push(
          `${a.router}/${b.router}: a passive interface on the shared prefix will not form an adjacency.`,
        );
    }),
  );
  const areas = new Set(interfaces.map((r) => r.area));
  if (areas.size > 1 && !areas.has('0'))
    warnings.push('Multiple areas are present without area 0. Check the backbone and ABR design.');
  const command = [...routers.values()]
    .map((r) =>
      [
        `! ${r.name}`,
        'enable',
        'configure terminal',
        `hostname ${r.name}`,
        'ipv6 unicast-routing',
        `ipv6 router ospf ${process}`,
        ` router-id ${r.id}`,
        ...r.rows.filter((x) => x.passive).map((x) => ` passive-interface ${x.iface}`),
        'exit',
        ...r.rows.flatMap((x) => [
          `interface ${x.iface}`,
          ` ipv6 address ${x.address}`,
          ` ipv6 ospf ${process} area ${x.area}`,
          ' no shutdown',
          'exit',
        ]),
        'end',
        'show ipv6 ospf neighbor',
        'show ipv6 ospf interface brief',
        'show ipv6 route ospf',
      ].join('\n'),
    )
    .join('\n\n');
  return { process, interfaces, routers: [...routers.values()], command, warnings };
}
