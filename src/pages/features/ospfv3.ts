import type { Values } from '../../app/storage';
import { ospfv3Plan } from '../../calculators/wan';
import { formHelpers } from '../../components/rows';
import { button, checkbox } from '../../components/ui';
import type { Lesson } from '../../explanations/model';
import { ospfv3Lesson } from '../../explanations/wan';
import { requiredNumber as num } from '../inputs';

export const feature = {
  tab: 'IPv6' as const,
  mode: 'ospf',

  row: { router: '', routerId: '', iface: '', address: '', area: '', passive: '' },
  render(v: Values, rows: Values[]): string {
    const { f, rf, rf4, controls } = formHelpers(v, rows);
    return (
      f(
        'ospfProcess',
        'OSPF process ID',
        'number',
        '1–65535. Classic IOS / Packet Tracer syntax.',
      ) +
      `<div class="row-list">${rows.map((r, i) => `<fieldset data-row="${i}"><legend>OSPF interface ${i + 1}</legend><div class="form-grid">${rf(i, 'router', 'Router name')}${rf4(i, 'routerId', 'OSPF router ID', { help: 'A unique 32-bit dotted ID per router; repeat it on this router’s rows.' })}</div>${rf(i, 'iface', 'Interface')}${rf(i, 'address', 'IPv6 interface address / prefix')}${rf(i, 'area', 'OSPF area', 'text', 'Decimal or dotted area ID. Enter 0 explicitly for the backbone.')}${checkbox(`r-${i}-passive`, 'Passive LAN interface', r.passive === 'on')}${controls(i)}</fieldset>`).join('')}</div>${button('add-row', '+ Add OSPF interface')}`
    );
  },
  calculate(v: Values, rows: Values[]): Lesson {
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
  },
};
