import { binaryIp, integer, intToIp, ipToInt } from './ipv4';
export type NumberBase = 'decimal' | 'binary' | 'octal' | 'hex';
export const numberBases: NumberBase[] = ['binary', 'octal', 'decimal', 'hex'];
export const radix: Record<NumberBase, number> = { decimal: 10, binary: 2, octal: 8, hex: 16 };
export const baseNames: Record<NumberBase, string> = {
  binary: 'Binary',
  octal: 'Octal',
  decimal: 'Decimal',
  hex: 'Hexadecimal',
};
const patterns: Record<NumberBase, RegExp> = {
  decimal: /^\d+$/,
  binary: /^[01]+$/,
  octal: /^[0-7]+$/,
  hex: /^[\dA-F]+$/,
};
function normalizeDigits(input: string, from: NumberBase, error: string): string {
  if (!Object.hasOwn(radix, from)) throw new Error(error);
  let text = input.trim();
  if (from === 'hex') text = text.replace(/^0x/i, '');
  if (from === 'binary') text = text.replace(/^0b/i, '');
  if (from === 'octal') text = text.replace(/^0o/i, '');
  text = text.toUpperCase();
  if (!patterns[from].test(text)) throw new Error(error);
  return text;
}
function formatNumber(value: number | bigint, to: NumberBase): string {
  if (!Object.hasOwn(radix, to)) throw new Error('Choose a valid target number base.');
  return value.toString(radix[to]).toUpperCase();
}
export interface Conversion {
  input: string;
  from: NumberBase;
  to: NumberBase;
  value: number;
  output: string;
}
export interface IntegerConversion {
  input: string;
  from: NumberBase;
  to: NumberBase;
  value: bigint;
  output: string;
}
export function convertInteger(input: string, from: NumberBase, to: NumberBase): IntegerConversion {
  const text = normalizeDigits(
    input,
    from,
    'Enter a nonnegative integer in the selected number base.',
  );
  if (text.length > 1024) throw new Error('Use at most 256 significant bits for manual working.');
  const prefixes: Record<NumberBase, string> = {
    binary: '0b',
    octal: '0o',
    hex: '0x',
    decimal: '',
  };
  const value = BigInt(prefixes[from] + text);
  if (value >= 1n << 256n) throw new Error('Use at most 256 significant bits for manual working.');
  return {
    input: text,
    from,
    to,
    value,
    output: formatNumber(value, to),
  };
}
export function convert(input: string, from: NumberBase, to: NumberBase, pad = true): Conversion {
  const text = normalizeDigits(input, from, `Enter a valid ${from} octet.`);
  const value = integer(parseInt(text, radix[from]), 0, 255, 'Octet value');
  let output = formatNumber(value, to);
  if (pad && to !== 'decimal')
    output = output.padStart(to === 'binary' ? 8 : to === 'octal' ? 3 : 2, '0');
  return { input: text, from, to, value, output };
}
export function convertIPv4(
  input: string,
  binaryInput = false,
): { decimal: string; binary: string; octets: Conversion[] } {
  let decimal = input.trim();
  if (binaryInput) {
    const parts = decimal.split('.');
    if (parts.length !== 4 || parts.some((p) => !/^[01]{8}$/.test(p)))
      throw new Error('Binary IPv4 needs four 8-bit octets separated by dots.');
    decimal = parts.map((p) => parseInt(p, 2)).join('.');
  }
  decimal = intToIp(ipToInt(decimal));
  return {
    decimal,
    binary: binaryIp(decimal),
    octets: decimal.split('.').map((p) => convert(p, 'decimal', 'binary')),
  };
}
