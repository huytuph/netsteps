import type { Subnet } from '../calculators/ipv4';
import type { VlsmPlan } from '../calculators/vlsm';
import { vlsmLesson } from './lessons';
import type { Lesson } from './model';
export function overlapLesson(networks: Subnet[], conflicts: string[]): Lesson {
  return {
    title: 'Subnet overlap check',
    summary: conflicts.length ? `${conflicts.length} overlaps detected` : 'No overlaps',
    metrics: [
      ['Compared networks', String(networks.length)],
      ['Overlaps', String(conflicts.length)],
    ],
    warnings: conflicts,
    columns: ['Network', 'Range'],
    rows: networks.map((n) => {
      return [`${n.network}/${n.prefix}`, `${n.network}–${n.end}`];
    }),
    why: 'Two ranges overlap when one starts before the other ends, and ends after the other starts.',
    methods: {
      recommended: networks.map((n) => {
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
export function transitLesson(plan: VlsmPlan): Lesson {
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
