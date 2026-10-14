import { binaryIp, intToIp } from '../calculators/ipv4';
import type { dhcpPlan, hsrpPlan, natPlan, vlanPlan } from '../calculators/services';
import { commandLesson } from './commands';
import type { Lesson } from './model';
export function hsrpLesson(r: ReturnType<typeof hsrpPlan>): Lesson {
  return commandLesson(
    'HSRP resilient gateway plan',
    [
      ['Virtual gateway', r.vip],
      ['Primary SVI', r.primary],
      ['Secondary SVI', r.secondary],
      ['Group', String(r.input.group)],
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
        text: `${r.input.priority1} > ${r.input.priority2}. Primary wins; preempt permits a recovered higher-priority switch to reclaim active status.`,
      },
      { title: 'Configure each SVI', text: r.command },
    ],
    'Reserve the shared gateway first, then one real address per switch. Explicit priorities make failover behavior easy to reason about.',
  );
}
export function vlanLesson(r: ReturnType<typeof vlanPlan>): Lesson {
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
export function natLesson(r: ReturnType<typeof natPlan>): Lesson {
  return commandLesson(
    'NAT / PAT overload plan',
    [
      ['Inside network', `${r.net.network}/${r.net.prefix}`],
      ['Wildcard', r.net.wildcard],
      ['WAN interface', r.outside],
    ],
    r.command,
    [
      {
        title: 'Match the inside subnet',
        text: `Mask ${r.net.mask}. Wildcard = 255.255.255.255 − mask = ${r.net.wildcard}.`,
      },
      {
        title: 'Label the boundaries',
        text: `${r.inside} faces inside hosts; ${r.outside} faces the WAN.`,
      },
      {
        title: 'Translate and multiplex',
        text: 'Inside local = original internal source. Inside global = translated source seen outside. NAT changes addresses; PAT also maps ports so multiple sessions can share the WAN interface address.',
      },
      {
        title: 'Enable overload',
        text: `ip nat inside source list ${r.acl} interface ${r.outside} overload`,
      },
    ],
    'The ACL selects inside sources; interface roles establish direction; overload distinguishes connections by ports.',
  );
}
export function dhcpLesson(r: ReturnType<typeof dhcpPlan>): Lesson {
  return commandLesson(
    'DHCP address pool plan',
    [
      ['Network', `${r.net.network}/${r.net.prefix}`],
      ['Available leases', String(r.available)],
      ['Default gateway', r.input.gateway],
      ['Option 150', r.input.tftp || 'Not configured'],
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
        text: `Gateway ${r.input.gateway}. ${r.input.dns ? 'DNS ' + r.input.dns + '. ' : ''}${r.input.tftp ? 'Option 150 supplies TFTP/CME server ' + r.input.tftp + ' to IP phones.' : ''}`,
      },
      { title: 'Generate the pool', text: r.command },
    ],
    'Reserve static infrastructure first, then give clients the remaining addresses and their network services.',
  );
}
