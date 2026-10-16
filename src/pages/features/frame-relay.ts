import type { Values } from '../../app/storage';
import { frameRelayPlan } from '../../calculators/wan';
import { formHelpers } from '../../components/rows';
import { area, button } from '../../components/ui';
import type { Lesson } from '../../explanations/model';
import { frameRelayLesson } from '../../explanations/wan';
import { lines, requiredNumber as num } from '../inputs';

export const feature = {
  tab: 'Frame Relay' as const,

  defaults: { router: '', parent: '', lanInterface: '', lanAddress: '' },
  row: { suffix: '', dlci: '', address: '', peer: '', networks: '' },
  render(v: Values, rows: Values[]): string {
    const { f, rf, f4, rf4, controls } = formHelpers(v, rows);
    return (
      f('router', 'Router name') +
      f('parent', 'Physical serial parent', 'text', 'For example Serial0/0/0.') +
      f('lanInterface', 'Local LAN interface (optional)') +
      f4('lanAddress', 'Local LAN IPv4/CIDR (optional)', { cidr: true }) +
      `<div class="row-list">${rows.map((_, i) => `<fieldset data-row="${i}"><legend>Circuit ${i + 1}</legend><div class="form-grid">${rf(i, 'suffix', 'Subinterface number', 'number')}${rf(i, 'dlci', 'Local DLCI', 'number', '16–1007.')}</div>${rf4(i, 'address', 'Local subinterface IPv4/CIDR', { cidr: true })}${rf4(i, 'peer', 'Remote circuit peer IPv4')}${area(`r-${i}-networks`, 'Remote LAN networks', rows[i].networks || '', 'One aligned IPv4/CIDR per line. Static routes are generated after the subinterfaces.')}${controls(i)}</fieldset>`).join('')}</div>${button('add-row', '+ Add circuit')}`
    );
  },
  calculate(v: Values, rows: Values[]): Lesson {
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
  },
};
