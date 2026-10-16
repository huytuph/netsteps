import type { Tab } from './storage';

export const sections = [
  'Dashboard',
  'Number Systems',
  'IP Addressing',
  'Routing',
  'LAN Services',
  'WAN Technologies',
  'Practice',
  'Settings',
] as const;
export type Section = (typeof sections)[number];
export const sectionMetadata = {
  Dashboard: { icon: '◈', description: 'Your networking study workspace.' },
  'Number Systems': { icon: '01', description: 'See how every bit, digit and octet is built.' },
  'IP Addressing': {
    icon: '▦',
    description: 'Calculate IPv4 and IPv6 addresses, subnets and allocation plans.',
  },
  Routing: {
    icon: '↗',
    description: 'Plan static routes, follow distance-vector updates and configure OSPFv3.',
  },
  'LAN Services': {
    icon: '◇',
    description: 'Plan VLANs, resilient gateways, DHCP and address translation.',
  },
  'WAN Technologies': {
    icon: '⇌',
    description: 'Connect networks with tunnels and Frame Relay circuits.',
  },
  Practice: { icon: '✎', description: 'Build confidence one problem at a time.' },
  Settings: { icon: '⚙', description: 'Make this workspace your own.' },
} satisfies Record<Section, { icon: string; description: string }>;

export interface NavigationTool {
  id: string;
  label: string;
  section: Section;
  tab: Tab;
  modes?: readonly string[];
  description?: string;
}
/** UI grouping is independent of the version-1 calculator IDs stored in backups. */
export const navigationTools: readonly NavigationTool[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'Dashboard', tab: 'Dashboard' },
  { id: 'numbers', label: 'Number Systems', section: 'Number Systems', tab: 'Number Systems' },
  {
    id: 'ipv4',
    label: 'IPv4 Subnetting',
    section: 'IP Addressing',
    tab: 'Subnetting',
    modes: ['subnet', 'hosts', 'mask', 'overlap'],
  },
  {
    id: 'ipv6',
    label: 'IPv6 Addressing',
    section: 'IP Addressing',
    tab: 'IPv6',
    modes: ['address', 'binary', 'subnet', 'plan', 'overlap'],
  },
  { id: 'vlsm', label: 'VLSM', section: 'IP Addressing', tab: 'VLSM' },
  {
    id: 'static-ipv4',
    label: 'IPv4 Static Routing',
    section: 'Routing',
    tab: 'Static Routing',
    modes: ['route', 'transit'],
  },
  {
    id: 'static-ipv6',
    label: 'IPv6 Static Routing',
    section: 'Routing',
    tab: 'IPv6',
    modes: ['route'],
    description: 'Plan IPv6 static, default and floating routes.',
  },
  { id: 'distance-vector', label: 'Distance Vector', section: 'Routing', tab: 'Distance Vector' },
  {
    id: 'ospfv3',
    label: 'OSPFv3',
    section: 'Routing',
    tab: 'IPv6',
    modes: ['ospf'],
    description: 'Build IPv6 OSPFv3 configurations for multiple routers and interfaces.',
  },
  {
    id: 'vlan',
    label: 'VLAN',
    section: 'LAN Services',
    tab: 'VLAN/HSRP',
    modes: ['vlan'],
    description: 'Plan VLAN subnets, access ports, trunks and voice VLANs.',
  },
  {
    id: 'hsrp',
    label: 'HSRP',
    section: 'LAN Services',
    tab: 'VLAN/HSRP',
    modes: ['hsrp'],
    description: 'Plan virtual gateways and primary/secondary router addresses.',
  },
  {
    id: 'dhcp',
    label: 'DHCP',
    section: 'LAN Services',
    tab: 'DHCP/NAT',
    modes: ['dhcp'],
    description: 'Build DHCP pools, exclusions and optional network services.',
  },
  {
    id: 'nat',
    label: 'NAT / PAT',
    section: 'LAN Services',
    tab: 'DHCP/NAT',
    modes: ['nat', 'dynamic'],
    description: 'Plan PAT overload or dynamic NAT translation pools.',
  },
  { id: 'tunnelling', label: 'Tunnelling', section: 'WAN Technologies', tab: 'Tunnelling' },
  { id: 'frame-relay', label: 'Frame Relay', section: 'WAN Technologies', tab: 'Frame Relay' },
  { id: 'practice', label: 'Practice', section: 'Practice', tab: 'Practice' },
  { id: 'settings', label: 'Settings', section: 'Settings', tab: 'Settings' },
];
export function toolFor(tab: Tab, mode?: string): NavigationTool {
  return (
    navigationTools.find(
      (tool) => tool.tab === tab && (!tool.modes || tool.modes.includes(mode || '')),
    ) || navigationTools.find((tool) => tool.tab === tab)!
  );
}
export function toolsIn(section: Section): readonly NavigationTool[] {
  return navigationTools.filter((tool) => tool.section === section);
}
export function locationLabel(tab: Tab, mode?: string): string {
  const tool = toolFor(tab, mode);
  return tool.section === tool.label ? tool.label : `${tool.section} · ${tool.label}`;
}
