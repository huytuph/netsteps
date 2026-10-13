import { Tab, Values } from '../app/storage';
import {
  binaryIp,
  hostsToPrefix,
  integer,
  intToIp,
  overlapRanges,
  parseNetwork,
  subnet,
} from '../calculators/ipv4';
import { convert, convertIPv4, NumberBase } from '../calculators/numbers';
import { planVlsm, Requirement } from '../calculators/vlsm';
import { staticRoute } from '../calculators/routing';
import { dhcpPlan, hsrpPlan, natPlan, vlanPlan } from '../calculators/services';
import {
  Lesson,
  commandLesson,
  hostsLesson,
  ipv4Lesson,
  numberLesson,
  routeLesson,
  subnetLesson,
  vlsmLesson,
} from '../explanations/lessons';
export function requirements(rows: Values[]): Requirement[] {
  return rows.map((r) => ({
    name: r.name,
    hosts: requiredNumber(r.hosts, 'Required hosts'),
    mode: r.mode as Requirement['mode'],
    locked: r.locked,
  }));
}
export function requiredNumber(value: string, label: string): number {
  if (!value?.trim()) throw new Error(`Enter ${label.toLowerCase()}.`);
  return Number(value);
}
export function calculate(tab: Tab, v: Values, rows: Values[]): Lesson {
  if (tab === 'Number Systems') {
    if (v.mode === 'octet')
      return numberLesson(
        convert(v.input, v.from as NumberBase, v.to as NumberBase, v.pad === 'on'),
      );
    const r = convertIPv4(v.mode === 'ipv4' ? v.ipv4 : v.binaryIpv4, v.mode === 'binary-ip');
    const l = ipv4Lesson(r.decimal, r.binary, r.octets);
    if (v.mode === 'binary-ip') l.summary = r.decimal;
    return l;
  }
  if (tab === 'Subnetting') {
    if (v.mode === 'hosts')
      return hostsLesson(
        hostsToPrefix(
          requiredNumber(v.hosts, 'Required usable hosts'),
          Number(v.reserve),
          Number(v.infrastructure),
          v.hostMode as Requirement['mode'],
        ),
      );
    if (v.mode === 'overlap') {
      const inputs = v.networks.split('\n').filter((s) => s.trim());
      if (inputs.length < 2 || inputs.length > 256)
        throw new Error('Enter 2–256 networks to compare.');
      const conflicts = overlapRanges(inputs);
      return {
        title: 'Subnet overlap check',
        summary: conflicts.length ? `${conflicts.length} overlaps detected` : 'No overlaps',
        metrics: [
          ['Compared networks', String(inputs.length)],
          ['Overlaps', String(conflicts.length)],
        ],
        warnings: conflicts,
        columns: ['Network', 'Range'],
        rows: inputs.map((s) => {
          const n = parseNetwork(s);
          return [`${n.network}/${n.prefix}`, `${n.network}–${n.end}`];
        }),
        why: 'Two ranges overlap when one starts before the other ends, and ends after the other starts.',
        methods: {
          recommended: inputs.map((s) => {
            const n = parseNetwork(s);
            return {
              title: `${n.network}/${n.prefix}`,
              text: `Interval [${n.startInt}, ${n.endInt}] = ${n.network}–${n.end}`,
            };
          }),
          formula: [
            {
              title: 'Pairwise range test',
              text: 'Overlap when A.start ≤ B.end AND B.start ≤ A.end.',
            },
          ],
          exam: [
            {
              title: 'Conflict result',
              text: conflicts.join('\n') || 'All supplied ranges are disjoint.',
            },
          ],
        },
      };
    }
    return subnetLesson(subnet(v.mode === 'mask' ? '0.0.0.0' : v.ip, v.prefix));
  }
  if (tab === 'VLSM')
    return vlsmLesson(
      planVlsm(v.base, requirements(rows), v.order !== 'manual', Number(v.reserve)),
    );
  if (tab === 'Static Routing') {
    if (v.mode === 'transit') {
      const count = integer(requiredNumber(v.links, 'Number of links'), 1, 256, 'Number of links');
      const plan = planVlsm(
        v.base,
        Array.from({ length: count }, (_, i) => ({
          name: `Link ${i + 1}`,
          hosts: 2,
          mode: v.linkMode === 'p2p' ? 'p2p' : 'lan',
        })),
      );
      const l = vlsmLesson(plan);
      l.title = 'Router-to-router transit allocation';
      l.columns = ['Link', 'Network', 'Mask', 'Router A', 'Router B', 'Broadcast'];
      l.rows = plan.allocations.map((a) => [
        a.name,
        `${a.subnet.network}/${a.subnet.prefix}`,
        a.subnet.mask,
        a.subnet.first,
        a.subnet.last,
        a.subnet.broadcast || 'None',
      ]);
      return l;
    }
    return routeLesson(
      staticRoute({
        destination: v.destination,
        nextHop: v.nextHop,
        exitInterface: v.exit,
        distance: requiredNumber(v.distance, 'Administrative distance'),
        primaryDistance:
          v.floating === 'on'
            ? requiredNumber(v.primaryDistance, 'Primary route distance')
            : Number(v.primaryDistance),
        floating: v.floating === 'on',
        connected: v.connected.split('\n'),
        localAddress: v.local,
      }),
    );
  }
  if (tab === 'VLAN/HSRP') {
    if (v.mode === 'hsrp') {
      const r = hsrpPlan({
        network: v.network,
        vip: v.vip,
        primary: v.primary,
        secondary: v.secondary,
        group: requiredNumber(v.group, 'HSRP group'),
        vlan: requiredNumber(v.vlan, 'VLAN ID'),
        priority1: requiredNumber(v.priority1, 'Primary priority'),
        priority2: requiredNumber(v.priority2, 'Secondary priority'),
      });
      return commandLesson(
        'HSRP resilient gateway plan',
        [
          ['Virtual gateway', r.vip],
          ['Primary SVI', r.primary],
          ['Secondary SVI', r.secondary],
          ['Group', v.group],
        ],
        r.command,
        [
          {
            title: 'Find usable addresses',
            text: `${r.net.network}/${r.net.prefix} → ${r.net.first}–${r.net.last}. Network and broadcast cannot be assigned.`,
          },
          {
            title: 'Reserve three distinct addresses',
            text: `VIP ${r.vip}; primary ${r.primary}; secondary ${r.secondary}. Hosts use the VIP as their default gateway.`,
          },
          {
            title: 'Set priorities',
            text: `${v.priority1} > ${v.priority2}. Primary wins; preempt permits a recovered higher-priority switch to reclaim active status.`,
          },
          { title: 'Configure each SVI', text: r.command },
        ],
        'Reserve the shared gateway first, then one real address per switch. Explicit priorities make failover behavior easy to reason about.',
      );
    }
    const r = vlanPlan(
      rows.map((row) => ({
        id: requiredNumber(row.id, 'VLAN ID'),
        name: row.name,
        network: row.network,
        gateway: row.gateway,
        ports: row.ports,
        voice: Number(row.voice),
        trunk: row.trunk,
      })),
    );
    r.forEach((a, i) => {
      const h = integer(
        requiredNumber(rows[i].hosts, 'Required VLAN hosts'),
        1,
        2 ** 32 - 2,
        'Required VLAN hosts',
      );
      if (h > a.subnet.usable - 1)
        throw new Error(
          `VLAN ${a.input.id}: ${h} hosts plus one gateway do not fit. Allocate subnets again or use a larger subnet.`,
        );
    });
    return commandLesson(
      'VLAN & voice allocation',
      [
        ['VLANs', String(r.length)],
        ['Gateway addresses reserved', String(r.length)],
      ],
      r.map((a) => a.command).join('\n\n'),
      r.flatMap((a) => [
        {
          title: `VLAN ${a.input.id} · Isolate traffic`,
          text: `${a.input.name} uses ${a.subnet.network}/${a.subnet.prefix}. Gateway ${a.gateway}. ${a.input.voice ? `PC traffic → VLAN ${a.input.id} untagged; phone traffic → VLAN ${a.input.voice} tagged.` : 'Data traffic uses the access VLAN.'}`,
        },
        {
          title: 'Check subnet capacity',
          text: `${a.subnet.usable} usable addresses; reserve one for the gateway. Binary mask: ${binaryIp(a.subnet.mask)}.`,
        },
        {
          title: 'Carry VLANs over trunks',
          text: `Trunk ${a.input.trunk || '(not supplied)'} must allow VLAN ${a.input.id}${a.input.voice ? ' and voice VLAN ' + a.input.voice : ''}. Voice subnet/DHCP planning is separate.`,
        },
      ]),
      'Plan a unique subnet and gateway for each data VLAN. Voice VLAN IDs tag phone traffic; their subnets can be planned separately.',
      r.map((a) => [
        String(a.input.id),
        a.input.name,
        a.input.voice ? String(a.input.voice) : 'None',
        `${a.subnet.network}/${a.subnet.prefix}`,
        a.subnet.mask,
        a.gateway,
        `${a.subnet.first}–${a.subnet.last}`,
        a.subnet.broadcast || 'None',
      ]),
      ['VLAN', 'Name', 'Voice VLAN', 'Subnet', 'Mask', 'Gateway', 'Host range', 'Broadcast'],
    );
  }
  if (tab === 'DHCP/NAT') {
    if (v.mode === 'nat') {
      const r = natPlan(
        v.insideNetwork,
        v.inside,
        v.outside,
        requiredNumber(v.acl, 'Standard ACL number'),
      );
      return commandLesson(
        'NAT / PAT overload plan',
        [
          ['Inside network', `${r.net.network}/${r.net.prefix}`],
          ['Wildcard', r.net.wildcard],
          ['WAN interface', v.outside],
        ],
        r.command,
        [
          {
            title: 'Match the inside subnet',
            text: `Mask ${r.net.mask}. Wildcard = 255.255.255.255 − mask = ${r.net.wildcard}.`,
          },
          {
            title: 'Label the boundaries',
            text: `${v.inside} faces inside hosts; ${v.outside} faces the WAN.`,
          },
          {
            title: 'Translate and multiplex',
            text: 'Inside local = original internal source. Inside global = translated source seen outside. NAT changes addresses; PAT also maps ports so multiple sessions can share the WAN interface address.',
          },
          {
            title: 'Enable overload',
            text: `ip nat inside source list ${v.acl} interface ${v.outside} overload`,
          },
        ],
        'The ACL selects inside sources; interface roles establish direction; overload distinguishes connections by ports.',
      );
    }
    const r = dhcpPlan({
      network: v.network,
      gateway: v.gateway,
      excluded: v.excluded,
      pool: v.pool,
      dns: v.dns,
      domain: v.domain,
      lease: requiredNumber(v.lease, 'Lease days'),
      tftp: v.tftp,
    });
    return commandLesson(
      'DHCP address pool plan',
      [
        ['Network', `${r.net.network}/${r.net.prefix}`],
        ['Available leases', String(r.available)],
        ['Default gateway', v.gateway],
        ['Option 150', v.tftp || 'Not configured'],
      ],
      r.command,
      [
        {
          title: 'Set the network and mask',
          text: `${r.net.network}/${r.net.prefix} → ${r.net.mask}. Usable range ${r.net.first}–${r.net.last}.`,
        },
        {
          title: 'Exclude infrastructure',
          text:
            r.excluded.map((x) => `${intToIp(x.start)}–${intToIp(x.end)}`).join('\n') +
            `\nGateway is always excluded. Remaining leases: ${r.available}.`,
        },
        {
          title: 'Provide client options',
          text: `Gateway ${v.gateway}. ${v.dns ? 'DNS ' + v.dns + '. ' : ''}${v.tftp ? 'Option 150 supplies TFTP/CME server ' + v.tftp + ' to IP phones.' : ''}`,
        },
        { title: 'Generate the pool', text: r.command },
      ],
      'Reserve static infrastructure first, then give clients the remaining addresses and their network services.',
    );
  }
  throw new Error('Select a calculator first.');
}
