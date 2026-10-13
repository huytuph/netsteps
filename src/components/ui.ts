import { Values } from '../app/storage';
export const esc = (v: unknown): string =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function field(
  name: string,
  label: string,
  value: string,
  type = 'text',
  help = '',
  attrs = '',
): string {
  return `<label class="field"><span>${esc(label)}</span><input aria-label="${esc(label)}" name="${esc(name)}" id="${esc(name)}" type="${type}" value="${esc(value)}" ${attrs}>${help ? `<small>${esc(help)}</small>` : ''}</label>`;
}
export function area(name: string, label: string, value: string, help = ''): string {
  return `<label class="field"><span>${esc(label)}</span><textarea aria-label="${esc(label)}" name="${esc(name)}" rows="3">${esc(value)}</textarea>${help ? `<small>${esc(help)}</small>` : ''}</label>`;
}
export function select(
  name: string,
  label: string,
  value: string,
  options: [string, string][],
  extra = '',
): string {
  return `<label class="field"><span>${esc(label)}</span><select aria-label="${esc(label)}" name="${esc(name)}" ${extra}>${options.map(([k, l]) => `<option value="${esc(k)}" ${k === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
export function checkbox(name: string, label: string, checked: boolean): string {
  return `<label class="check"><input type="checkbox" name="${esc(name)}" ${checked ? 'checked' : ''}>${esc(label)}</label>`;
}
export function table(columns: string[], rows: string[][]): string {
  return `<div class="table-scroll" tabindex="0" aria-label="Results table"><table><thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export const button = (action: string, label: string, extra = ''): string =>
  `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
export function readValues(form: HTMLFormElement): Values {
  const values = Object.fromEntries(
    [...new FormData(form)].filter(([k]) => !k.startsWith('r-')).map(([k, v]) => [k, String(v)]),
  );
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((el) => {
    values[el.name] = el.checked ? 'on' : '';
  });
  return values;
}
export function readRows(form: HTMLFormElement): Values[] {
  return [...form.querySelectorAll<HTMLElement>('[data-row]')].map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')].map((e) => [
        e.name.split('-').slice(2).join('-'),
        e.value,
      ]),
    ),
  );
}
export async function copy(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall back for local files */
    }
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.left = '-10000px';
  document.body.append(el);
  el.select();
  const ok = document.execCommand('copy');
  el.remove();
  if (!ok) throw new Error('Clipboard is unavailable. Export the result as a file instead.');
}
export function download(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
