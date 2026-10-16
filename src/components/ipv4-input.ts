import { esc } from './ui';

export type IPv4Layout = 'full' | 'octets';
export interface IPv4FieldOptions {
  cidr?: boolean;
  binary?: boolean;
  help?: string;
}
interface AddressParts {
  address: string;
  prefix: string;
  octets: string[];
  splittable: boolean;
}
export function splitIPv4Value(value: string, cidr = false, binary = false): AddressParts {
  const slash = cidr ? value.indexOf('/') : -1;
  const address = slash < 0 ? value : value.slice(0, slash);
  const prefix = slash < 0 ? '' : value.slice(slash + 1);
  const pieces = address.trim().split('.');
  const splittable =
    pieces.length <= 4 &&
    pieces.every((part) => /^\d*$/.test(part) && part.length <= (binary ? 8 : 3));
  return {
    address,
    prefix,
    octets: Array.from({ length: 4 }, (_, i) => pieces[i] || ''),
    splittable,
  };
}
export function joinIPv4Value(address: string, prefix: string, cidr = false): string {
  return address + (cidr && prefix !== '' ? `/${prefix}` : '');
}
export function ipv4Field(
  name: string,
  label: string,
  value = '',
  options: IPv4FieldOptions = {},
): string {
  const { cidr = false, binary = false, help = '' } = options;
  return `<fieldset class="ipv4-field" data-ipv4-field data-binary="${binary}" data-cidr="${cidr}" data-layout="full">
    <legend>${esc(label)}</legend>
    <input type="hidden" name="${esc(name)}" id="${esc(name)}" value="${esc(value)}" data-ipv4-value>
    <div data-ipv4-full><input type="text" aria-label="${esc(label)}" data-ipv4-address inputmode="decimal" autocomplete="off" spellcheck="false"></div>
    <div class="ipv4-octets" data-ipv4-octets hidden>${Array.from({ length: 4 }, (_, i) => `<label class="ipv4-octet"><span>Octet ${i + 1}</span><input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${esc(label)} octet ${i + 1}" data-ipv4-part="${i}"></label>`).join('')}</div>
    ${cidr ? `<label class="ipv4-prefix"><span>CIDR /</span><input type="text" inputmode="numeric" aria-label="${esc(label)} prefix length" data-ipv4-prefix autocomplete="off"><small>0–32</small></label>` : ''}
    <small class="ipv4-help">${esc(help || (binary ? 'Four octets of exactly 8 binary digits each.' : 'Each octet is a decimal value from 0 to 255.'))}</small>
    <p class="ipv4-error" data-ipv4-error aria-live="polite" hidden></p>
    <p class="ipv4-fallback" data-ipv4-fallback hidden>This value cannot fit four octet fields. Correct it using the full-address field; the entered value has been preserved.</p>
  </fieldset>`;
}
const valueInput = (field: HTMLElement) =>
  field.querySelector<HTMLInputElement>('[data-ipv4-value]')!;
function showValidation(field: HTMLElement): void {
  const binary = field.dataset.binary === 'true';
  const cidr = field.dataset.cidr === 'true';
  const { address, prefix } = splitIPv4Value(valueInput(field).value, cidr, binary);
  const parts = address.trim().split('.');
  const partInputs = [...field.querySelectorAll<HTMLInputElement>('[data-ipv4-part]')];
  const full = field.querySelector<HTMLInputElement>('[data-ipv4-address]')!;
  let error = '';
  const validPart = (part: string) =>
    binary ? /^[01]{8}$/.test(part) : /^\d{1,3}$/.test(part) && Number(part) <= 255;
  const hasValue = address.trim() !== '' || prefix !== '';
  for (let i = 0; i < 4; i++) {
    const invalid = hasValue && !validPart(parts[i] || '');
    partInputs[i].setAttribute('aria-invalid', String(invalid));
    if (invalid && !error)
      error = binary
        ? `Octet ${i + 1} needs exactly 8 binary digits (0 or 1).`
        : `Octet ${i + 1} must be a decimal value from 0 to 255.`;
  }
  if (hasValue && parts.length !== 4 && field.dataset.layout === 'full')
    error = binary
      ? 'Enter four 8-bit binary octets separated by dots.'
      : 'Enter four decimal octets separated by dots.';
  full.setAttribute('aria-invalid', String(!!error));
  const prefixInput = field.querySelector<HTMLInputElement>('[data-ipv4-prefix]');
  if (prefixInput) {
    const invalid = prefix !== '' && (!/^\d{1,2}$/.test(prefix) || Number(prefix) > 32);
    prefixInput.setAttribute('aria-invalid', String(invalid));
    if (invalid && !error) error = 'CIDR prefix length must be a whole number from 0 to 32.';
  }
  const message = field.querySelector<HTMLElement>('[data-ipv4-error]')!;
  message.textContent = error;
  message.hidden = !error;
}
function hydrateField(field: HTMLElement, layout: IPv4Layout): void {
  const parts = splitIPv4Value(
    valueInput(field).value,
    field.dataset.cidr === 'true',
    field.dataset.binary === 'true',
  );
  const split = layout === 'octets' && parts.splittable;
  field.dataset.layout = split ? 'octets' : 'full';
  field.querySelector<HTMLInputElement>('[data-ipv4-address]')!.value = parts.address;
  field
    .querySelectorAll<HTMLInputElement>('[data-ipv4-part]')
    .forEach((input, i) => (input.value = parts.octets[i]));
  const prefix = field.querySelector<HTMLInputElement>('[data-ipv4-prefix]');
  if (prefix) prefix.value = parts.prefix;
  field.querySelector<HTMLElement>('[data-ipv4-full]')!.hidden = split;
  field.querySelector<HTMLElement>('[data-ipv4-octets]')!.hidden = !split;
  field.querySelector<HTMLElement>('[data-ipv4-fallback]')!.hidden =
    layout !== 'octets' || parts.splittable;
  showValidation(field);
}
export function initialiseIPv4Inputs(root: ParentNode, layout: IPv4Layout): void {
  root
    .querySelectorAll<HTMLElement>('[data-ipv4-field]')
    .forEach((field) => hydrateField(field, layout));
}
/** Keep one canonical value for calculations, drafts, row operations and version-1 saves. */
export function syncIPv4Input(input: HTMLInputElement, commit = false): boolean {
  const field = input.closest<HTMLElement>('[data-ipv4-field]');
  if (!field) return false;
  if (input.hasAttribute('data-ipv4-value')) {
    hydrateField(field, field.dataset.layout === 'octets' ? 'octets' : 'full');
    return true;
  }
  const cidr = field.dataset.cidr === 'true';
  // Pasting a complete address into an octet, or address/CIDR into the full
  // address field, distributes it without retaining a second slash suffix.
  if (
    (input.hasAttribute('data-ipv4-part') && input.value.includes('.')) ||
    (input.hasAttribute('data-ipv4-address') && cidr && input.value.includes('/'))
  ) {
    const pasted = splitIPv4Value(input.value, cidr, field.dataset.binary === 'true');
    if (
      input.hasAttribute('data-ipv4-address') ||
      (pasted.splittable && pasted.address.split('.').length === 4)
    ) {
      const prefix = field.querySelector<HTMLInputElement>('[data-ipv4-prefix]');
      const pastedPrefix = cidr && input.value.includes('/') ? pasted.prefix : prefix?.value || '';
      valueInput(field).value =
        cidr && input.value.includes('/')
          ? input.value
          : joinIPv4Value(pasted.address, pastedPrefix, cidr);
      if (input.hasAttribute('data-ipv4-address') && !commit) {
        if (prefix) prefix.value = pastedPrefix;
        showValidation(field);
        return true;
      }
      hydrateField(field, field.dataset.layout === 'octets' ? 'octets' : 'full');
      return true;
    }
  }
  const fullAddress = field.querySelector<HTMLInputElement>('[data-ipv4-address]')!;
  if (input.hasAttribute('data-ipv4-prefix') && cidr && fullAddress.value.includes('/'))
    fullAddress.value = splitIPv4Value(
      fullAddress.value,
      true,
      field.dataset.binary === 'true',
    ).address;
  const address =
    field.dataset.layout === 'octets'
      ? [...field.querySelectorAll<HTMLInputElement>('[data-ipv4-part]')]
          .map((part) => part.value)
          .join('.')
      : fullAddress.value;
  const allBlank = field.dataset.layout === 'octets' && address === '...';
  const prefix = field.querySelector<HTMLInputElement>('[data-ipv4-prefix]')?.value || '';
  valueInput(field).value = joinIPv4Value(
    allBlank ? '' : address,
    prefix,
    field.dataset.cidr === 'true',
  );
  // Keep the other representation ready without replacing the focused input or its cursor.
  const parts = splitIPv4Value(
    valueInput(field).value,
    field.dataset.cidr === 'true',
    field.dataset.binary === 'true',
  );
  if (input.hasAttribute('data-ipv4-address'))
    field
      .querySelectorAll<HTMLInputElement>('[data-ipv4-part]')
      .forEach((part, i) => (part.value = parts.octets[i]));
  else field.querySelector<HTMLInputElement>('[data-ipv4-address]')!.value = parts.address;
  showValidation(field);
  return true;
}
export function captureIPv4Inputs(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-ipv4-field]').forEach((field) => {
    const stored = splitIPv4Value(
      valueInput(field).value,
      field.dataset.cidr === 'true',
      field.dataset.binary === 'true',
    );
    const prefix = field.querySelector<HTMLInputElement>('[data-ipv4-prefix]')?.value || '';
    const unchanged =
      field.dataset.layout === 'octets'
        ? [...field.querySelectorAll<HTMLInputElement>('[data-ipv4-part]')].every(
            (input, i) => input.value === stored.octets[i],
          )
        : field.querySelector<HTMLInputElement>('[data-ipv4-address]')!.value === stored.address;
    if (unchanged && prefix === stored.prefix) return;
    const selector = field.dataset.layout === 'octets' ? '[data-ipv4-part]' : '[data-ipv4-address]';
    syncIPv4Input(field.querySelector<HTMLInputElement>(selector)!, true);
  });
}
