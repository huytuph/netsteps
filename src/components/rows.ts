import type { Values } from '../app/storage';
import { button, field } from './ui';

export function rowControls(index: number, count: number): string {
  return `<div class="row-actions">${button('up', '↑ Move', `data-index="${index}" ${index === 0 ? 'disabled' : ''}`)}${button('down', '↓ Move', `data-index="${index}" ${index === count - 1 ? 'disabled' : ''}`)}${button('remove-row', 'Remove', `data-index="${index}"`)}</div>`;
}
export function formHelpers(values: Values, rows: Values[]) {
  return {
    f: (key: string, label: string, type = 'text', help = '', attrs = '') =>
      field(key, label, values[key] || '', type, help, attrs),
    rf: (i: number, key: string, label: string, type = 'text', help = '') =>
      field(`r-${i}-${key}`, label, rows[i][key] || '', type, help),
    controls: (i: number) => rowControls(i, rows.length),
  };
}
