import type { Values } from '../../app/storage';
import { distanceVector } from '../../calculators/distance-vector';
import { formHelpers } from '../../components/rows';
import { area, button, select } from '../../components/ui';
import type { Lesson } from '../../explanations/model';
import { distanceVectorLesson } from '../../explanations/wan';
import { choice, lines, requiredNumber as num, words } from '../inputs';

export const feature = {
  tab: 'Distance Vector' as const,

  defaults: { mode: 'synchronous', nodes: '', rounds: '', order: '', attachments: '' },
  row: { a: '', b: '', cost: '' },
  render(v: Values, rows: Values[]): string {
    const { f, rf, controls } = formHelpers(v, rows);
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
  },
  calculate(v: Values, rows: Values[]): Lesson {
    return distanceVectorLesson(
      distanceVector({
        nodes: words(v.nodes),
        links: rows.map((r) => ({ a: r.a, b: r.b, cost: num(r.cost, 'Link cost') })),
        rounds: num(v.rounds, 'Number of rounds'),
        mode: choice(v.mode, ['synchronous', 'sequential'], 'round convention'),
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
  },
};
