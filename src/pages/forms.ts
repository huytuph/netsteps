import { Tab, Values } from '../app/storage';
import { field, select, checkbox, area, button, esc } from '../components/ui';
import { topics } from '../calculators/practice';
export const descriptions: Record<Tab, string> = {
  Dashboard: 'Your networking study workspace.',
  'Number Systems': 'See how every bit, digit and octet is built.',
  Subnetting: 'Find the boundaries. Understand the working.',
  VLSM: 'Give every network room to grow.',
  'Static Routing': 'Connect the destination to the next hop.',
  'VLAN/HSRP': 'Plan segmented networks and resilient gateways.',
  'DHCP/NAT': 'Build address pools and translate traffic.',
  Practice: 'Build confidence one problem at a time.',
  Settings: 'Make this workspace your own.',
};
export const baseValues: Partial<Record<Tab, Values>> = {
  'Number Systems': {
    mode: 'octet',
    input: '',
    from: 'decimal',
    to: 'binary',
    pad: 'on',
    ipv4: '',
    binaryIpv4: '',
  },
  Subnetting: {
    mode: 'subnet',
    ip: '',
    prefix: '',
    hosts: '',
    reserve: '',
    infrastructure: '',
    hostMode: 'lan',
    networks: '',
  },
  VLSM: { base: '', order: 'auto', reserve: '' },
  'Static Routing': {
    mode: 'route',
    destination: '',
    nextHop: '',
    exit: '',
    distance: '',
    primaryDistance: '',
    connected: '',
    local: '',
    base: '',
    links: '',
    linkMode: 'lan',
  },
  'VLAN/HSRP': {
    mode: 'vlan',
    base: '',
    network: '',
    vip: '',
    primary: '',
    secondary: '',
    group: '',
    vlan: '',
    priority1: '',
    priority2: '',
  },
  'DHCP/NAT': {
    mode: 'dhcp',
    network: '',
    gateway: '',
    excluded: '',
    pool: '',
    dns: '',
    domain: '',
    lease: '',
    tftp: '',
    insideNetwork: '',
    inside: '',
    outside: '',
    acl: '',
  },
  Practice: {
    topic: 'Network address',
    difficulty: 'Easy',
    customIp: '',
    customPrefix: '',
    customHosts: '',
    customRows: '',
    customNextHop: '',
  },
};
export function blankRow(tab: Tab): Values {
  return tab === 'VLSM'
    ? { name: '', hosts: '', mode: 'lan', locked: '' }
    : { id: '', name: '', hosts: '', network: '', gateway: '', ports: '', voice: '', trunk: '' };
}
export function initialRows(tab: Tab): Values[] {
  return tab === 'VLSM' || tab === 'VLAN/HSRP' ? [blankRow(tab)] : [];
}
const modes: [string, string][] = [
  ['lan', 'LAN (/30 or larger)'],
  ['p2p', 'Point-to-point /31'],
  ['host', 'Host route /32'],
];
export function formFields(tab: Tab, v: Values, rows: Values[]): string {
  const f = (key: string, label: string, type = 'text', help = '', attrs = '') =>
    field(key, label, v[key] || '', type, help, attrs);
  const s = (key: string, label: string, options: [string, string][], extra = '') =>
    select(key, label, v[key] || '', options, extra);
  const mode = (options: [string, string][]) => s('mode', 'Tool', options, 'data-mode');
  if (tab === 'Number Systems')
    return (
      mode([
        ['octet', 'Octet conversion'],
        ['ipv4', 'IPv4 → Binary'],
        ['binary-ip', 'Binary IPv4 → Decimal'],
      ]) +
      (v.mode === 'octet'
        ? `<div class="form-grid">${s('from', 'From', [
            ['decimal', 'Decimal'],
            ['binary', 'Binary'],
            ['hex', 'Hexadecimal'],
          ])}${s('to', 'To', [
            ['binary', 'Binary'],
            ['decimal', 'Decimal'],
            ['hex', 'Hexadecimal'],
          ])}</div>${f('input', 'Octet value', 'text', 'Decimal equivalent must be 0–255.')} ${checkbox('pad', 'Pad binary to 8 bits / hex to 2 digits', v.pad === 'on')}`
        : v.mode === 'ipv4'
          ? f('ipv4', 'IPv4 address')
          : f('binaryIpv4', 'Binary IPv4', 'text', 'Four 8-bit octets separated by dots.'))
    );
  if (tab === 'Subnetting')
    return (
      mode([
        ['subnet', 'IPv4 subnet analysis'],
        ['hosts', 'Required hosts → CIDR'],
        ['mask', 'CIDR / Mask converter'],
        ['overlap', 'Check subnet overlaps'],
      ]) +
      (v.mode === 'hosts'
        ? f('hosts', 'Required usable hosts', 'number', '', 'min="1"') +
          `<div class="form-grid">${f('reserve', 'Reserve %', 'number', '', 'min="0" step="0.1"')}${f('infrastructure', 'Infrastructure addresses', 'number', '', 'min="0"')}</div>` +
          s('hostMode', 'Address mode', modes)
        : v.mode === 'overlap'
          ? area('networks', 'Networks to compare', v.networks, 'One IPv4/CIDR per line.')
          : v.mode === 'mask'
            ? f(
                'prefix',
                'CIDR prefix or subnet mask',
                'text',
                'For example /27 or 255.255.255.224.',
              )
            : f('ip', 'IPv4 address') +
              f(
                'prefix',
                'CIDR prefix or subnet mask',
                'text',
                'For example /27 or 255.255.255.224.',
              ))
    );
  if (tab === 'VLSM')
    return (
      f('base', 'Base network', 'text', 'Use an aligned network/CIDR.') +
      `<div class="form-grid">${s('order', 'Allocation order', [
        ['auto', 'Largest first (recommended)'],
        ['manual', 'Manual row order'],
      ])}${f('reserve', 'Reserve %', 'number', 'Applied to each row.', 'min="0" step="0.1"')}</div><div class="row-list">${rows.map((r, i) => `<fieldset data-row="${i}"><legend>Network ${i + 1}</legend><div class="form-grid">${field(`r-${i}-name`, 'Name', r.name)}${field(`r-${i}-hosts`, 'Required hosts', r.hosts, 'number', '', 'min="1"')}</div>${select(`r-${i}-mode`, 'Address mode', r.mode, modes)}${field(`r-${i}-locked`, 'Locked subnet (optional)', r.locked || '', 'text', 'Leave empty for automatic allocation.')}<div class="row-actions">${button('up', '↑ Move', `data-index="${i}" ${i === 0 ? 'disabled' : ''}`)}${button('down', '↓ Move', `data-index="${i}" ${i === rows.length - 1 ? 'disabled' : ''}`)}${button('remove-row', 'Remove', `data-index="${i}"`)}</div></fieldset>`).join('')}</div>${button('add-row', '+ Add network')}`
    );
  if (tab === 'Static Routing')
    return (
      mode([
        ['route', 'Static / default / floating route'],
        ['transit', 'Router transit links'],
      ]) +
      (v.mode === 'transit'
        ? f('base', 'Transit address block') +
          f('links', 'Number of links', 'number', '', 'min="1" max="256"') +
          s('linkMode', 'Link prefix', [
            ['lan', '/30 traditional'],
            ['p2p', '/31 point-to-point'],
          ])
        : f('destination', 'Destination network', 'text', 'Use 0.0.0.0/0 for a default route.') +
          button('default-route', 'Use default route') +
          `<div class="form-grid">${f('nextHop', 'Next hop (optional)')}${f('exit', 'Exit interface (optional)')}</div>` +
          f('local', 'Local router IP (optional)') +
          area(
            'connected',
            'Connected networks',
            v.connected,
            'One network/CIDR per line. Include the transit link for next-hop validation.',
          ) +
          `<div class="form-grid">${f('distance', 'Administrative distance', 'number', '', 'min="1" max="254"')}${f('primaryDistance', 'Primary route distance', 'number', '', 'min="1" max="254"')}</div>` +
          checkbox('floating', 'Generate floating backup route', v.floating === 'on'))
    );
  if (tab === 'VLAN/HSRP')
    return (
      mode([
        ['vlan', 'VLAN & voice planner'],
        ['hsrp', 'HSRP address planner'],
      ]) +
      (v.mode === 'hsrp'
        ? f('network', 'HSRP subnet') +
          `<div class="form-grid">${f('vlan', 'VLAN ID', 'number')}${f('group', 'HSRP v1 group', 'number')}</div>` +
          f('vip', 'Virtual gateway', 'text', 'Blank uses the first usable address.') +
          `<div class="form-grid">${f('primary', 'Primary SVI IP (optional)')}${f('secondary', 'Secondary SVI IP (optional)')}</div><div class="form-grid">${f('priority1', 'Primary priority', 'number')}${f('priority2', 'Secondary priority', 'number')}</div>`
        : f('base', 'Base for host-based allocation') +
          button('allocate-vlans', 'Allocate subnets from host counts') +
          `<div class="row-list">${rows.map((r, i) => `<fieldset data-row="${i}"><legend>VLAN ${esc(r.id)}</legend><div class="form-grid">${field(`r-${i}-id`, 'VLAN ID', r.id, 'number')}${field(`r-${i}-name`, 'Name', r.name)}</div><div class="form-grid">${field(`r-${i}-hosts`, 'Required hosts', r.hosts, 'number')}${field(`r-${i}-voice`, 'Voice VLAN (0 = none)', r.voice, 'number')}</div>${field(`r-${i}-network`, 'Assigned subnet', r.network)}${field(`r-${i}-gateway`, 'Gateway (optional)', r.gateway, 'text', 'Blank uses the first usable address.')}<div class="form-grid">${field(`r-${i}-ports`, 'Access-port range', r.ports)}${field(`r-${i}-trunk`, 'Trunk interface', r.trunk)}</div><div class="row-actions">${button('up', '↑ Move', `data-index="${i}" ${i === 0 ? 'disabled' : ''}`)}${button('down', '↓ Move', `data-index="${i}" ${i === rows.length - 1 ? 'disabled' : ''}`)}${button('remove-row', 'Remove', `data-index="${i}"`)}</div></fieldset>`).join('')}</div>${button('add-row', '+ Add VLAN')}`)
    );
  if (tab === 'DHCP/NAT')
    return (
      mode([
        ['dhcp', 'DHCP / Option 150 pool'],
        ['nat', 'NAT / PAT overload'],
      ]) +
      (v.mode === 'nat'
        ? f('insideNetwork', 'Inside network') +
          `<div class="form-grid">${f('inside', 'Inside interface')}${f('outside', 'WAN / outside interface')}</div>` +
          f('acl', 'Standard ACL number', 'number', '1–99.')
        : f('network', 'Pool network') +
          `<div class="form-grid">${f('pool', 'Pool name')}${f('gateway', 'Default gateway')}</div>` +
          area(
            'excluded',
            'Excluded addresses / ranges',
            v.excluded,
            'One start-end range per line. Gateway is automatically excluded.',
          ) +
          f('dns', 'DNS servers (optional)', 'text', 'Comma or space separated.') +
          `<div class="form-grid">${f('domain', 'Domain (optional)')}${f('lease', 'Lease days', 'number', '0 = infinite.', 'min="0" max="365"')}</div>` +
          f('tftp', 'TFTP / Option 150 IP (optional)'))
    );
  if (tab === 'Practice')
    return (
      s(
        'topic',
        'Question topic',
        topics.map((t) => [t, t]),
      ) +
      s(
        'difficulty',
        'Difficulty',
        [
          ['Easy', 'Easy'],
          ['Medium', 'Medium'],
          ['Hard', 'Hard'],
          ['Custom', 'Custom'],
        ],
        'data-mode',
      ) +
      (v.difficulty === 'Custom'
        ? `<div class="note">Custom question builder. Choose the topic above; these values supply that topic.</div>${f('customIp', 'IP address')}${f('customPrefix', 'CIDR prefix')}${f('customHosts', 'Required hosts', 'number')}${area('customRows', 'VLSM / VLAN / router requirements', v.customRows, 'One name,hosts per line. Add router links as rows with 2 hosts. Use the IP/CIDR as the base network.')}${f('customNextHop', 'Route next hop')}`
        : '')
    );
  return '';
}
