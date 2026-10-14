import type { Values } from '../../app/storage';
import { dynamicNat } from '../../calculators/wan';
import { formHelpers } from '../../components/rows';
import { area } from '../../components/ui';
import type { Lesson } from '../../explanations/model';
import { dynamicNatLesson } from '../../explanations/wan';
import { lines, requiredNumber as num } from '../inputs';

export const feature = {
  tab: 'DHCP/NAT' as const,
  mode: 'dynamic',

  render(v: Values, rows: Values[]): string {
    const { f, rf, controls } = formHelpers(v, rows);
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
  },
  calculate(v: Values, rows: Values[]): Lesson {
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
  },
};
