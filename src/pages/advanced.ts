import type { Tab, Values } from '../app/storage';
import { field, select, checkbox, area, button } from '../components/ui';
import { dynamicNat, tunnelPlan, frameRelayPlan, ospfv3Plan } from '../calculators/wan';
import { distanceVector } from '../calculators/distance-vector';
import {
  dynamicNatLesson,
  tunnelLesson,
  frameRelayLesson,
  ospfv3Lesson,
  distanceVectorLesson,
} from '../explanations/wan';
import type { Lesson } from '../explanations/lessons';

export const advancedDefaults: Partial<Record<Tab, Values>> = {
  Tunnelling: {
    mode: 'ipv6ip',
    tunnelId: '',
    aName: '',
    aWanInterface: '',
    aWanAddress: '',
    aTunnelAddress: '',
    aLanInterface: '',
    aLanAddress: '',
    aNextHop: '',
    bName: '',
    bWanInterface: '',
    bWanAddress: '',
    bTunnelAddress: '',
    bLanInterface: '',
    bLanAddress: '',
    bNextHop: '',
  },
  'Distance Vector': { mode: 'synchronous', nodes: '', rounds: '', order: '', attachments: '' },
  'Frame Relay': { router: '', parent: '', lanInterface: '', lanAddress: '' },
};
export function advancedRow(tab: Tab): Values | null {
  if (tab === 'Distance Vector') return { a: '', b: '', cost: '' };
  if (tab === 'Frame Relay') return { suffix: '', dlci: '', address: '', peer: '', networks: '' };
  return null;
}
export function advancedFields(tab: Tab, v: Values, rows: Values[]): string | null {
  const f = (key: string, label: string, type = 'text', help = '') =>
    field(key, label, v[key] || '', type, help);
  const rf = (i: number, key: string, label: string, type = 'text', help = '') =>
    field(`r-${i}-${key}`, label, rows[i][key] || '', type, help);
  const controls = (i: number) =>
    `<div class="row-actions">${button('up', '↑ Move', `data-index="${i}" ${i === 0 ? 'disabled' : ''}`)}${button('down', '↓ Move', `data-index="${i}" ${i === rows.length - 1 ? 'disabled' : ''}`)}${button('remove-row', 'Remove', `data-index="${i}"`)}</div>`;
  if (tab === 'DHCP/NAT' && v.mode === 'dynamic')
    return (
      f('pool', 'Translation pool name') +
      area(
        'insideNetwork',
        'Inside source networks',
        v.insideNetwork || '',
        'One aligned IPv4/CIDR per line.',
      ) +
      `<div class="form-grid">${f('poolStart', 'Translation pool start')}${f('poolEnd', 'Translation pool end')}</div>` +
      f(
        'poolPrefix',
        'Pool CIDR or subnet mask',
        'text',
        'Use the actual translation subnet mask, not a mask calculated from the pool count.',
      ) +
      f('acl', 'Standard ACL number', 'number', '1–99.') +
      `<div class="form-grid">${f('inside', 'Inside interface')}${f('outside', 'Outside interface')}</div>` +
      f('insideAddress', 'Inside interface IPv4/CIDR (optional)') +
      f('outsideAddress', 'Outside interface IPv4/CIDR (optional)') +
      f('outsideNextHop', 'Outside default-route next hop (optional)') +
      '<p class="note">Dynamic NAT uses a pool without overload. Interfaces and routes omitted here must already be configured in the lab.</p>'
    );
  if (tab === 'Tunnelling')
    return (
      select(
        'mode',
        'Tunnel type',
        v.mode,
        [
          ['ipv6ip', 'IPv6 over IPv4 (course example)'],
          ['gre4', 'GRE over IPv4 — IPv4 LANs'],
          ['gre6', 'GRE over IPv4 — IPv6 LANs'],
        ],
        'data-mode',
      ) +
      f('tunnelId', 'Tunnel number', 'number', '0–65535; enter explicitly.') +
      ['a', 'b']
        .map(
          (key, i) =>
            `<fieldset><legend>Router ${i === 0 ? 'A' : 'B'}</legend>${f(key + 'Name', `Router ${i === 0 ? 'A' : 'B'} name`)}${f(key + 'WanInterface', 'Physical WAN interface')}${f(key + 'WanAddress', 'WAN IPv4 address / CIDR')}${f(key + 'NextHop', 'Underlay IPv4 next hop (optional)', 'text', 'Needed if the remote outer endpoint is not directly connected and no route already exists.')}${f(key + 'TunnelAddress', v.mode === 'gre4' ? 'Tunnel IPv4 address / CIDR' : 'Tunnel IPv6 address / prefix')}${f(key + 'LanInterface', 'LAN interface')}${f(key + 'LanAddress', v.mode === 'gre4' ? 'LAN IPv4 address / CIDR' : 'LAN IPv6 address / prefix')}</fieldset>`,
        )
        .join('')
    );
  if (tab === 'Distance Vector')
    return (
      f(
        'nodes',
        'Router names (optional)',
        'text',
        'Comma or space separated. Blank derives routers from the links; list isolated routers explicitly.',
      ) +
      select(
        'mode',
        'Round convention',
        v.mode,
        [
          ['synchronous', 'Simultaneous exchanges (recommended)'],
          ['sequential', 'Sequential router sweeps'],
        ],
        'data-mode',
      ) +
      f(
        'rounds',
        'Number of rounds',
        'number',
        '1–8. Round 0 already contains direct neighbor costs.',
      ) +
      (v.mode === 'sequential'
        ? f(
            'order',
            'Router update order',
            'text',
            'List every router once, separated by commas or spaces. Each router uses the latest available tables.',
          )
        : '') +
      `<p class="note">Enter the weighted, undirected links from your diagram. Unreachable destinations start at ∞. Equal-cost next hops are retained.</p><div class="row-list">${rows.map((_, i) => `<fieldset data-row="${i}"><legend>Link ${i + 1}</legend><div class="form-grid">${rf(i, 'a', 'Router A')}${rf(i, 'b', 'Router B')}</div>${rf(i, 'cost', 'Link cost', 'number', 'Positive integer; use 1 per link for a simple hop-count exercise.')}${controls(i)}</fieldset>`).join('')}</div>${button('add-row', '+ Add link')}` +
      area(
        'attachments',
        'Attached destinations (optional)',
        v.attachments || '',
        'One router,network-label,cost per line. Example format: R1,LAN-A,0. Leave blank for router-to-router vectors.',
      )
    );
  if (tab === 'Frame Relay')
    return (
      f('router', 'Router name') +
      f('parent', 'Physical serial parent', 'text', 'For example Serial0/0/0.') +
      f('lanInterface', 'Local LAN interface (optional)') +
      f('lanAddress', 'Local LAN IPv4/CIDR (optional)') +
      `<div class="row-list">${rows.map((_, i) => `<fieldset data-row="${i}"><legend>Circuit ${i + 1}</legend><div class="form-grid">${rf(i, 'suffix', 'Subinterface number', 'number')}${rf(i, 'dlci', 'Local DLCI', 'number', '16–1007.')}</div>${rf(i, 'address', 'Local subinterface IPv4/CIDR')}${rf(i, 'peer', 'Remote circuit peer IPv4')}${area(`r-${i}-networks`, 'Remote LAN networks', rows[i].networks || '', 'One aligned IPv4/CIDR per line. Static routes are generated after the subinterfaces.')}${controls(i)}</fieldset>`).join('')}</div>${button('add-row', '+ Add circuit')}`
    );
  if (tab === 'IPv6' && v.mode === 'ospf')
    return (
      f(
        'ospfProcess',
        'OSPF process ID',
        'number',
        '1–65535. Classic IOS / Packet Tracer syntax.',
      ) +
      `<div class="row-list">${rows.map((r, i) => `<fieldset data-row="${i}"><legend>OSPF interface ${i + 1}</legend><div class="form-grid">${rf(i, 'router', 'Router name')}${rf(i, 'routerId', 'OSPF router ID', 'text', 'A unique 32-bit dotted ID per router; repeat it on this router’s rows.')}</div>${rf(i, 'iface', 'Interface')}${rf(i, 'address', 'IPv6 interface address / prefix')}${rf(i, 'area', 'OSPF area', 'text', 'Decimal or dotted area ID. Enter 0 explicitly for the backbone.')}${checkbox(`r-${i}-passive`, 'Passive LAN interface', r.passive === 'on')}${controls(i)}</fieldset>`).join('')}</div>${button('add-row', '+ Add OSPF interface')}`
    );
  return null;
}
const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const words = (s: string) => s.split(/[\s,]+/).filter(Boolean);
const num = (s: string, label: string) => {
  if (!s?.trim()) throw new Error(`Enter ${label.toLowerCase()}.`);
  return Number(s);
};
export function advancedCalculation(tab: Tab, v: Values, rows: Values[]): Lesson | null {
  if (tab === 'DHCP/NAT' && v.mode === 'dynamic')
    return dynamicNatLesson(
      dynamicNat({
        networks: lines(v.insideNetwork),
        pool: v.pool,
        start: v.poolStart,
        end: v.poolEnd,
        prefix: v.poolPrefix,
        acl: num(v.acl, 'Standard ACL number'),
        inside: v.inside,
        outside: v.outside,
        insideAddress: v.insideAddress,
        outsideAddress: v.outsideAddress,
        nextHop: v.outsideNextHop,
      }),
    );
  if (tab === 'Tunnelling')
    return tunnelLesson(
      tunnelPlan({
        mode: v.mode as 'ipv6ip' | 'gre4' | 'gre6',
        id: num(v.tunnelId, 'Tunnel number'),
        a: {
          name: v.aName,
          wanInterface: v.aWanInterface,
          wanAddress: v.aWanAddress,
          tunnelAddress: v.aTunnelAddress,
          lanInterface: v.aLanInterface,
          lanAddress: v.aLanAddress,
          underlayNextHop: v.aNextHop,
        },
        b: {
          name: v.bName,
          wanInterface: v.bWanInterface,
          wanAddress: v.bWanAddress,
          tunnelAddress: v.bTunnelAddress,
          lanInterface: v.bLanInterface,
          lanAddress: v.bLanAddress,
          underlayNextHop: v.bNextHop,
        },
      }),
    );
  if (tab === 'Distance Vector')
    return distanceVectorLesson(
      distanceVector({
        nodes: words(v.nodes),
        links: rows.map((r) => ({ a: r.a, b: r.b, cost: num(r.cost, 'Link cost') })),
        rounds: num(v.rounds, 'Number of rounds'),
        mode: v.mode as 'synchronous' | 'sequential',
        order: words(v.order),
        attachments: lines(v.attachments).map((line) => {
          const parts = line.split(',').map((x) => x.trim());
          if (parts.length !== 3)
            throw new Error('Attached destination rows use router,network-label,cost.');
          return {
            router: parts[0],
            destination: parts[1],
            cost: num(parts[2], 'Attached destination cost'),
          };
        }),
      }),
    );
  if (tab === 'Frame Relay')
    return frameRelayLesson(
      frameRelayPlan(
        v.router,
        v.parent,
        rows.map((r) => ({
          suffix: num(r.suffix, 'Subinterface number'),
          dlci: num(r.dlci, 'Local DLCI'),
          address: r.address,
          peer: r.peer,
          remoteNetworks: lines(r.networks),
        })),
        v.lanInterface,
        v.lanAddress,
      ),
    );
  if (tab === 'IPv6' && v.mode === 'ospf')
    return ospfv3Lesson(
      ospfv3Plan(
        num(v.ospfProcess, 'OSPF process ID'),
        rows.map((r) => ({
          router: r.router,
          routerId: r.routerId,
          iface: r.iface,
          address: r.address,
          area: r.area,
          passive: r.passive === 'on',
        })),
      ),
    );
  return null;
}
