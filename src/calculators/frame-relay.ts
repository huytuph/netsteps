import { host4, token, unicast4 } from './endpoints';
import { integer, overlaps, parseNetwork, requireHost, Subnet } from './ipv4';
import { interfaceName } from './routing';
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
