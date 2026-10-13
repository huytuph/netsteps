import { binaryIp, intToIp, ipToInt, integer } from './ipv4';
export type NumberBase = 'decimal' | 'binary' | 'hex';
export interface Conversion {
  input: string;
  from: NumberBase;
  to: NumberBase;
  value: number;
  output: string;
}
export function convert(input: string, from: NumberBase, to: NumberBase, pad = true): Conversion {
  const text = input
    .trim()
    .replace(from === 'hex' ? /^0x/i : from === 'binary' ? /^0b/i : /^$/, '')
    .toUpperCase();
  const patterns = { decimal: /^\d+$/, binary: /^[01]+$/, hex: /^[\dA-F]+$/ };
  if (!patterns[from].test(text)) throw new Error(`Enter a valid ${from} octet.`);
  const radix = { decimal: 10, binary: 2, hex: 16 };
  const value = integer(parseInt(text, radix[from]), 0, 255, 'Octet value');
  let output = value.toString(radix[to]).toUpperCase();
  if (pad && to !== 'decimal') output = output.padStart(to === 'binary' ? 8 : 2, '0');
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
