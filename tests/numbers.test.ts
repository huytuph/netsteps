import { describe, it, expect } from 'vitest';
import { convert, convertIPv4 } from '../src/calculators/numbers';
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
