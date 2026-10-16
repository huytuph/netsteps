import type { Tab } from './storage';
export const toolMetadata = {
  Dashboard: { icon: '◈', description: 'Your networking study workspace.' },
  'Number Systems': { icon: '01', description: 'See how every bit, digit and octet is built.' },
  Subnetting: { icon: '▦', description: 'Find the boundaries. Understand the working.' },
  IPv6: { icon: '⑥', description: 'Analyze IPv6 formats, prefixes, allocations and overlaps.' },
  VLSM: { icon: '⇆', description: 'Give every network room to grow.' },
  'Static Routing': { icon: '↗', description: 'Connect the destination to the next hop.' },
  'VLAN/HSRP': { icon: '◇', description: 'Plan segmented networks and resilient gateways.' },
  'DHCP/NAT': { icon: '⇄', description: 'Build address pools and translate traffic.' },
  Practice: { icon: '✎', description: 'Build confidence one problem at a time.' },
  Settings: { icon: '⚙', description: 'Make this workspace your own.' },
  Tunnelling: { icon: '⇌', description: 'Join two LANs across an IPv4 underlay.' },
  'Distance Vector': {
    icon: '↔',
    description: 'Follow every routing-table update, one round at a time.',
  },
  'Frame Relay': {
    icon: '⋈',
    description: 'Plan point-to-point circuits, DLCIs and static routes.',
  },
} satisfies Record<Tab, { icon: string; description: string }>;
export const descriptions = Object.fromEntries(
  Object.entries(toolMetadata).map(([tab, tool]) => [tab, tool.description]),
) as Record<Tab, string>;
