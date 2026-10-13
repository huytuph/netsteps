import { Subnet, integer, ipToInt, overlaps, parseNetwork, requireHost, intToIp } from './ipv4';
import { interfaceName } from './routing';
export function token(text: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(text))
    throw new Error(`${label} must be 1–32 letters, digits, dots, hyphens or underscores.`);
  return text;
}
export interface VlanInput {
  id: number;
  name: string;
  network: string;
  gateway: string;
  ports: string;
  voice: number;
  trunk: string;
}
export interface VlanResult {
  subnet: Subnet;
  gateway: string;
  command: string;
  input: VlanInput;
}
export function vlanPlan(rows: VlanInput[]): VlanResult[] {
  if (!rows.length || rows.length > 256) throw new Error('Provide 1–256 VLAN rows.');
  const ids = new Set<number>(),
    assigned: Subnet[] = [],
    voiceIds = new Set(rows.filter((r) => r.voice).map((r) => r.voice));
  return rows.map((r) => {
    integer(r.id, 1, 4094, 'VLAN ID');
    if (ids.has(r.id)) throw new Error(`Duplicate VLAN ID ${r.id}.`);
    ids.add(r.id);
    token(r.name, 'VLAN name');
    const net = parseNetwork(r.network, true);
    if (net.prefix > 30) throw new Error('A VLAN LAN needs a subnet of /30 or larger.');
    if (assigned.some((a) => overlaps(a, net)))
      throw new Error(`VLAN ${r.id} subnet overlaps another VLAN.`);
    assigned.push(net);
    const gateway = r.gateway.trim() || net.first;
    requireHost(gateway, net, 'Gateway');
    if (r.voice) {
      integer(r.voice, 1, 4094, 'Voice VLAN');
      if (r.voice === r.id) throw new Error('Voice and access VLAN IDs must differ.');
    }
    if (voiceIds.has(r.id))
      throw new Error(`VLAN ${r.id} is also used as a voice VLAN; use a separate data VLAN.`);
    if (r.ports && !/^[A-Za-z][A-Za-z0-9/., -]{0,79}$/.test(r.ports))
      throw new Error('Invalid access-port range.');
    const commands = [`vlan ${r.id}`, ` name ${r.name}`];
    if (r.voice) commands.push(`vlan ${r.voice}`, ` name VOICE_${r.voice}`);
    if (r.ports)
      commands.push(
        `interface range ${r.ports}`,
        ' switchport mode access',
        ` switchport access vlan ${r.id}`,
        ...(r.voice ? [` switchport voice vlan ${r.voice}`] : []),
      );
    if (r.trunk)
      commands.push(
        `interface ${interfaceName(r.trunk)}`,
        ' switchport mode trunk',
        ` switchport trunk allowed vlan add ${r.id}${r.voice ? ',' + r.voice : ''}`,
      );
    commands.push(`interface Vlan${r.id}`, ` ip address ${gateway} ${net.mask}`, ' no shutdown');
    return { subnet: net, gateway, command: commands.join('\n'), input: r };
  });
}
export interface HsrpInput {
  network: string;
  vip: string;
  primary: string;
  secondary: string;
  group: number;
  priority1: number;
  priority2: number;
  vlan: number;
}
export function hsrpPlan(input: HsrpInput) {
  const net = parseNetwork(input.network, true);
  if (net.prefix > 29)
    throw new Error('HSRP requires at least three usable addresses (/29 or larger).');
  integer(input.group, 0, 255, 'HSRP v1 group');
  integer(input.vlan, 1, 4094, 'VLAN ID');
  integer(input.priority1, 0, 255, 'Primary priority');
  integer(input.priority2, 0, 255, 'Secondary priority');
  if (input.priority1 <= input.priority2)
    throw new Error(
      'Primary priority must exceed secondary priority for a predictable primary role.',
    );
  const vip = input.vip.trim() || net.first,
    primary = input.primary.trim() || intToIp(net.startInt + 2),
    secondary = input.secondary.trim() || intToIp(net.startInt + 3);
  [vip, primary, secondary].forEach((ip) => requireHost(ip, net, 'HSRP address'));
  if (new Set([vip, primary, secondary].map(ipToInt)).size !== 3)
    throw new Error('HSRP virtual gateway and both SVI addresses must be distinct.');
  const command = [
    [primary, input.priority1],
    [secondary, input.priority2],
  ]
    .map(
      ([ip, priority], i) =>
        `! L3 switch ${i + 1}\ninterface Vlan${input.vlan}\n ip address ${ip} ${net.mask}\n standby ${input.group} ip ${vip}\n standby ${input.group} priority ${priority}\n standby ${input.group} preempt\n no shutdown`,
    )
    .join('\n\n');
  return { net, vip, primary, secondary, command };
}
export interface DhcpInput {
  network: string;
  gateway: string;
  excluded: string;
  pool: string;
  dns: string;
  domain: string;
  lease: number;
  tftp: string;
}
export function dhcpPlan(input: DhcpInput) {
  const net = parseNetwork(input.network, true);
  if (net.prefix > 30) throw new Error('DHCP LAN pools require /30 or larger.');
  token(input.pool, 'Pool name');
  requireHost(input.gateway, net, 'Default gateway');
  const ranges = input.excluded
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(/\s*-\s*|\s+/);
      if (parts.length > 2) throw new Error('Excluded ranges use start-end, one range per line.');
      const start = ipToInt(parts[0]),
        end = ipToInt(parts[1] || parts[0]);
      requireHost(intToIp(start), net, 'Excluded start');
      requireHost(intToIp(end), net, 'Excluded end');
      if (start > end) throw new Error('Excluded range start must not exceed its end.');
      return { start, end };
    });
  const gateway = ipToInt(input.gateway);
  if (!ranges.some((r) => gateway >= r.start && gateway <= r.end))
    ranges.push({ start: gateway, end: gateway });
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  ranges.forEach((r) => {
    const last = merged.at(-1);
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  });
  const dns = input.dns.split(/[\s,]+/).filter(Boolean);
  dns.forEach(ipToInt);
  if (input.tftp) ipToInt(input.tftp);
  if (input.domain && !/^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/.test(input.domain))
    throw new Error('Invalid domain name.');
  integer(input.lease, 0, 365, 'Lease days');
  const available = net.usable - merged.reduce((n, r) => n + r.end - r.start + 1, 0);
  if (available === 0)
    throw new Error('All usable addresses are excluded; the DHCP pool would be empty.');
  const command = [
    ...merged.map(
      (r) =>
        `ip dhcp excluded-address ${intToIp(r.start)}${r.end !== r.start ? ' ' + intToIp(r.end) : ''}`,
    ),
    `ip dhcp pool ${input.pool}`,
    ` network ${net.network} ${net.mask}`,
    ` default-router ${input.gateway}`,
    ...(dns.length ? [` dns-server ${dns.join(' ')}`] : []),
    ...(input.domain ? [` domain-name ${input.domain}`] : []),
    ` lease ${input.lease === 0 ? 'infinite' : input.lease}`,
    ...(input.tftp ? [` option 150 ip ${input.tftp}`] : []),
  ].join('\n');
  return { net, available, excluded: merged, command };
}
export function natPlan(network: string, inside: string, outside: string, acl: number) {
  const net = parseNetwork(network, true);
  integer(acl, 1, 99, 'Standard ACL number');
  const intIn = interfaceName(inside),
    intOut = interfaceName(outside);
  if (intIn.toLowerCase() === intOut.toLowerCase())
    throw new Error('Inside and outside interfaces must be distinct.');
  return {
    net,
    command: `access-list ${acl} permit ${net.network} ${net.wildcard}\ninterface ${intIn}\n ip nat inside\ninterface ${intOut}\n ip nat outside\nip nat inside source list ${acl} interface ${intOut} overload`,
  };
}
