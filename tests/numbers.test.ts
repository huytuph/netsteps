import { describe, it, expect } from 'vitest';
import { convert, convertInteger, convertIPv4, type NumberBase } from '../src/calculators/numbers';
describe('octet conversions', () => {
  it('converts decimal, binary and hex endpoints', () => {
    expect(convert('0', 'decimal', 'binary').output).toBe('00000000');
    expect(convert('255', 'decimal', 'hex').output).toBe('FF');
    expect(convert('0xFF', 'hex', 'decimal').output).toBe('255');
    expect(convert('01010001', 'binary', 'hex').output).toBe('51');
    expect(convert('51', 'hex', 'binary').output).toBe('01010001');
  });
  it('roundtrips all 256 octet values in all bases', () => {
    for (let i = 0; i <= 255; i++)
      for (const base of ['decimal', 'binary', 'hex'] as const) {
        const r = convert(String(i), 'decimal', base);
        expect(convert(r.output, base, 'decimal').value).toBe(i);
      }
  });
  it('supports unpadded output', () =>
    expect(convert('1', 'decimal', 'binary', false).output).toBe('1'));
  it.each([
    ['256', 'decimal'],
    ['2', 'binary'],
    ['GG', 'hex'],
    ['-1', 'decimal'],
    ['1.5', 'decimal'],
    ['', 'decimal'],
  ])('rejects %s in %s', (v, b) => expect(() => convert(v, b as 'decimal', 'binary')).toThrow());
  it('converts IPv4 both directions', () => {
    const r = convertIPv4('81.42.38.18');
    expect(r.binary).toBe('01010001.00101010.00100110.00010010');
    expect(convertIPv4(r.binary, true).decimal).toBe('81.42.38.18');
    expect(() => convertIPv4('1.00000000.00000000.00000000', true)).toThrow(/8-bit/);
  });
});
describe('shared number parsing with separate limits', () => {
  it.each([
    ['  0x00fF  ', 'hex', '00FF', 255],
    [' 0B00000101 ', 'binary', '00000101', 5],
    [' 00081 ', 'decimal', '00081', 81],
  ] as const)(
    'normalizes %s consistently for both converters',
    (input, base, normalized, value) => {
      const octet = convert(input, base, 'decimal');
      const integer = convertInteger(input, base, 'decimal');
      expect(octet.input).toBe(normalized);
      expect(integer.input).toBe(normalized);
      expect(octet.value).toBe(value);
      expect(integer.value).toBe(BigInt(value));
    },
  );
  it('retains octet bounds and padding while allowing exact 256-bit integers', () => {
    expect(convertInteger('256', 'decimal', 'hex').output).toBe('100');
    expect(() => convert('256', 'decimal', 'hex')).toThrow(/Octet/);
    expect(convert('1', 'decimal', 'binary').output).toBe('00000001');
    expect(convertInteger('1', 'decimal', 'binary').output).toBe('1');
    const maximum = (1n << 256n) - 1n;
    expect(convertInteger(String(maximum), 'decimal', 'hex').output).toBe('F'.repeat(64));
    expect(() => convertInteger(String(maximum + 1n), 'decimal', 'hex')).toThrow(
      /256 significant bits/,
    );
    expect(() => convertInteger('0'.repeat(1025), 'decimal', 'hex')).toThrow(
      /256 significant bits/,
    );
  });
  it.each(['', '-1', '+1', '1.2', '1 2', '0x', '0x GG'])(
    'rejects malformed input %s in both converters',
    (input) => {
      expect(() => convert(input, 'hex', 'decimal')).toThrow();
      expect(() => convertInteger(input, 'hex', 'decimal')).toThrow();
    },
  );
  it.each(['invalid', '__proto__', 'toString'])(
    'rejects unsupported base %s without a type error',
    (invalid) => {
      for (const converter of [convert, convertInteger]) {
        expect(() => converter('10', invalid as NumberBase, 'decimal')).toThrow(Error);
        expect(() => converter('10', 'decimal', invalid as NumberBase)).toThrow(
          /target number base/,
        );
      }
    },
  );
});
