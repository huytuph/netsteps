// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  captureIPv4Inputs,
  initialiseIPv4Inputs,
  ipv4Field,
  joinIPv4Value,
  splitIPv4Value,
  syncIPv4Input,
} from '../src/components/ipv4-input';
import { readRows, readValues } from '../src/components/ui';

const get = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
function setup(value = '', cidr = false, binary = false) {
  document.body.innerHTML = `<form>${ipv4Field('ip', 'Address', value, { cidr, binary })}</form>`;
  initialiseIPv4Inputs(document, 'full');
}
function edit(selector: string, value: string, commit = false) {
  get(selector).value = value;
  syncIPv4Input(get(selector), commit);
}
beforeEach(() => setup());

describe('IPv4 input representations', () => {
  it.each([
    '',
    '0.0.0.0',
    '255.255.255.255',
    '192.0.2.1',
    '192..2.',
    '192',
    '...',
    '1.2.3.4.5',
    '<img src=x>',
    '192.0.2.0/0',
    '192.0.2.0/',
    '/24',
    '192.0.2.0/24/25',
  ])('preserves the original value %s when only switching layouts', (value) => {
    setup(value, true);
    for (const layout of ['octets', 'full', 'octets', 'full'] as const) {
      initialiseIPv4Inputs(document, layout);
      captureIPv4Inputs(document);
      expect(get('[name="ip"]').value).toBe(value);
    }
    expect(document.querySelector('img')).toBeNull();
  });
  it('starts blank in both layouts without inserting zero octets or a prefix', () => {
    setup('', true);
    initialiseIPv4Inputs(document, 'octets');
    expect(
      [...document.querySelectorAll<HTMLInputElement>('input')].every(
        (input) => input.value === '',
      ),
    ).toBe(true);
    expect(get('[data-ipv4-full]').hidden).toBe(true);
    expect(get('[data-ipv4-octets]').hidden).toBe(false);
    expect(get('[data-ipv4-error]').hidden).toBe(true);
  });
  it('joins edited octets and prefix while keeping only the canonical value in form data', () => {
    setup('', true);
    initialiseIPv4Inputs(document, 'octets');
    ['192', '0', '2', '0'].forEach((value, i) => edit(`[data-ipv4-part="${i}"]`, value));
    edit('[data-ipv4-prefix]', '24');
    expect(readValues(document.querySelector('form')!)).toEqual({ ip: '192.0.2.0/24' });
    initialiseIPv4Inputs(document, 'full');
    expect(get('[data-ipv4-address]').value).toBe('192.0.2.0');
    expect(get('[data-ipv4-prefix]').value).toBe('24');
  });
  it('preserves full-address typing until commit, then separates its CIDR prefix', () => {
    setup('', true);
    for (const value of ['192.0.2.0/', '192.0.2.0/2', '192.0.2.0/24']) {
      edit('[data-ipv4-address]', value);
      expect(get('[data-ipv4-address]').value).toBe(value);
      expect(get('[name="ip"]').value).toBe(value);
    }
    captureIPv4Inputs(document);
    expect(get('[data-ipv4-address]').value).toBe('192.0.2.0');
    expect(get('[data-ipv4-prefix]').value).toBe('24');
    expect(get('[name="ip"]').value).toBe('192.0.2.0/24');
  });
  it('distributes a complete pasted address into four octets and keeps the prefix', () => {
    setup('', true);
    initialiseIPv4Inputs(document, 'octets');
    edit('[data-ipv4-part="0"]', '192.0.2.0/24');
    expect(
      [...document.querySelectorAll<HTMLInputElement>('[data-ipv4-part]')].map(
        (input) => input.value,
      ),
    ).toEqual(['192', '0', '2', '0']);
    expect(get('[data-ipv4-prefix]').value).toBe('24');
    expect(get('[name="ip"]').value).toBe('192.0.2.0/24');
  });
  it('captures autofilled controls even when no input event was sent', () => {
    get('[data-ipv4-address]').value = '198.51.100.2';
    captureIPv4Inputs(document);
    expect(get('[name="ip"]').value).toBe('198.51.100.2');
    initialiseIPv4Inputs(document, 'octets');
    get('[data-ipv4-part="3"]').value = '3';
    captureIPv4Inputs(document);
    expect(get('[name="ip"]').value).toBe('198.51.100.3');
  });
  it('validates octet endpoints, incomplete values and prefix bounds without truncating them', () => {
    setup('0.255.2.1/0', true);
    initialiseIPv4Inputs(document, 'octets');
    expect(get('[data-ipv4-error]').hidden).toBe(true);
    edit('[data-ipv4-part="1"]', '256');
    expect(get('[data-ipv4-error]').textContent).toContain('Octet 2');
    expect(get('[name="ip"]').value).toBe('0.256.2.1/0');
    edit('[data-ipv4-part="1"]', '255');
    edit('[data-ipv4-prefix]', '33');
    expect(get('[data-ipv4-error]').textContent).toContain('0 to 32');
    edit('[data-ipv4-prefix]', '32');
    expect(get('[data-ipv4-error]').hidden).toBe(true);
    edit('[data-ipv4-part="1"]', '');
    expect(get('[data-ipv4-error]').textContent).toContain('Octet 2');
    for (let i = 0; i < 4; i++) edit(`[data-ipv4-part="${i}"]`, '');
    edit('[data-ipv4-prefix]', '');
    expect(get('[name="ip"]').value).toBe('');
  });
  it('keeps malformed full values visible instead of dropping extra octets', () => {
    setup('1.2.3.4.5');
    initialiseIPv4Inputs(document, 'octets');
    expect(get('[data-ipv4-full]').hidden).toBe(false);
    expect(get('[data-ipv4-fallback]').hidden).toBe(false);
    expect(get('[data-ipv4-address]').value).toBe('1.2.3.4.5');
  });
  it('uses exact eight-bit fields for binary input and retains leading zeros', () => {
    setup('00000000.11111111.00000010.00000001', false, true);
    initialiseIPv4Inputs(document, 'octets');
    expect(get('[data-ipv4-error]').hidden).toBe(true);
    edit('[data-ipv4-part="2"]', '00000012');
    expect(get('[data-ipv4-error]').textContent).toContain('8 binary digits');
    edit('[data-ipv4-part="2"]', '1');
    expect(get('[data-ipv4-part="2"]').getAttribute('aria-invalid')).toBe('true');
    edit('[data-ipv4-part="2"]', '00000001');
    expect(get('[name="ip"]').value).toBe('00000000.11111111.00000001.00000001');
  });
  it('reads row addresses without adding unnamed helper fields to saved rows', () => {
    document.body.innerHTML = `<form><fieldset data-row="0">${ipv4Field('r-0-network', 'Network', '192.0.2.0/24', { cidr: true })}</fieldset></form>`;
    initialiseIPv4Inputs(document, 'octets');
    expect(readRows(document.querySelector('form')!)).toEqual([{ network: '192.0.2.0/24' }]);
  });
  it('keeps structural parsing separate from calculation and leaves invalid text intact', () => {
    expect(splitIPv4Value('192.0.2.1/24', true)).toMatchObject({
      address: '192.0.2.1',
      prefix: '24',
      splittable: true,
    });
    expect(joinIPv4Value('192.0.2.1', '0', true)).toBe('192.0.2.1/0');
    expect(splitIPv4Value('256.0.0.1').octets[0]).toBe('256');
  });
});
