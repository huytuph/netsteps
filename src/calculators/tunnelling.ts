import { host4, host6, token, unicast4 } from './endpoints';
import { integer, ipToInt, overlaps, requireHost, type Subnet } from './ipv4';
import { ipv6Overlaps } from './ipv6';
import { interfaceName } from './routing';
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
  return input.mode === 'gre4'
    ? planTunnel(input, {
        ipv6: false,
        parse: host4,
        overlaps,
        address: (n) => `ip address ${n.ip} ${n.mask}`,
        route: (n, hop) => `ip route ${n.network} ${n.mask} ${hop}`,
        overlapsWan: (n, wan) => overlaps(n, wan),
      })
    : planTunnel(input, {
        ipv6: true,
        parse: host6,
        overlaps: ipv6Overlaps,
        address: (n) => `ipv6 address ${n.ip}/${n.prefix}`,
        route: (n, hop) => `ipv6 route ${n.network}/${n.prefix} ${hop}`,
        overlapsWan: () => false,
      });
}

interface Prefix {
  ip: string;
  network: string;
  prefix: number;
}
interface TunnelFamily<N extends Prefix> {
  ipv6: boolean;
  parse(text: string, label: string): N;
  overlaps(a: N, b: N): boolean;
  address(n: N): string;
  route(n: N, nextHop: string): string;
  overlapsWan(n: N, wan: Subnet): boolean;
}

function planTunnel<N extends Prefix>(input: TunnelInput, family: TunnelFamily<N>) {
  const id = integer(input.id, 0, 65535, 'Tunnel number'),
    v6 = family.ipv6;
  const endpoints = [input.a, input.b].map((e) => {
    const name = token(e.name, 'Router name'),
      wanInterface = interfaceName(e.wanInterface),
      lanInterface = interfaceName(e.lanInterface);
    if (wanInterface.toLowerCase() === lanInterface.toLowerCase())
      throw new Error(`${name}: LAN and WAN interfaces must differ.`);
    if (/^tunnel/i.test(wanInterface) || /^tunnel/i.test(lanInterface))
      throw new Error('LAN/WAN must be physical interfaces, not the tunnel being created.');
    const wan = host4(e.wanAddress, 'WAN endpoint');
    const tunnel = family.parse(e.tunnelAddress, 'Tunnel address');
    const lan = family.parse(e.lanAddress, 'LAN address');
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
  const nets = [a.lan, b.lan, a.tunnel];
  if (
    nets.some((n, i) => nets.slice(i + 1).some((m) => family.overlaps(n, m))) ||
    nets.some((n) => [a.wan, b.wan].some((w) => family.overlapsWan(n, w)))
  )
    throw new Error(
      v6
        ? 'LANs and the tunnel must use disjoint prefixes.'
        : 'Inner LAN/tunnel networks must be disjoint and separate from the outer IPv4 networks.',
    );
  const blocks = endpoints.map((e, i) => {
    const remote = endpoints[1 - i],
      lines = [
        `! ${e.name}`,
        'enable',
        'configure terminal',
        `hostname ${e.name}`,
        ...(v6 ? ['ipv6 unicast-routing'] : []),
        `interface ${e.wanInterface}`,
        ` ip address ${e.wan.ip} ${e.wan.mask}`,
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
      ` ${family.address(e.lan)}`,
      ' no shutdown',
      'exit',
      `interface Tunnel${id}`,
    );
    if (v6) lines.push(' no ip address');
    lines.push(` ${family.address(e.tunnel)}`);
    lines.push(
      ` tunnel source ${e.wanInterface}`,
      ` tunnel destination ${remote.wan.ip}`,
      ` tunnel mode ${input.mode === 'ipv6ip' ? 'ipv6ip' : 'gre ip'}`,
      ' no shutdown',
      'exit',
      family.route(remote.lan, remote.tunnel.ip),
      'end',
      `show interfaces Tunnel${id}`,
      v6 ? 'show ipv6 route' : 'show ip route',
    );
    return lines.join('\n');
  });
  return { mode: input.mode, id, endpoints, command: blocks.join('\n\n'), warnings };
}
