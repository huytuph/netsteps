import type { Values } from '../../app/storage';
import { tunnelPlan } from '../../calculators/wan';
import { formHelpers } from '../../components/rows';
import { select } from '../../components/ui';
import type { Lesson } from '../../explanations/model';
import { tunnelLesson } from '../../explanations/wan';
import { choice, requiredNumber as num } from '../inputs';

export const feature = {
  tab: 'Tunnelling' as const,

  defaults: {
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

  render(v: Values, rows: Values[]): string {
    const { f, rf, controls } = formHelpers(v, rows);
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
  },
  calculate(v: Values, rows: Values[]): Lesson {
    return tunnelLesson(
      tunnelPlan({
        mode: choice(v.mode, ['ipv6ip', 'gre4', 'gre6'], 'tunnel type'),
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
  },
};
