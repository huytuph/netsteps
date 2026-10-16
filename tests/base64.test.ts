import { describe, expect, it } from 'vitest';
import { convertBase64, maxManualBytes } from '../src/calculators/base64';
import { base64Lesson } from '../src/explanations/base64';

describe('standard Base64 (RFC 4648)', () => {
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes and decodes the reference vector %s', (plain, encoded) => {
    expect(convertBase64(plain, 'encode', 'text').output).toBe(encoded);
    expect(convertBase64(encoded, 'decode', 'text').output).toBe(plain);
  });
  it('preserves Unicode, byte order marks, whitespace and nulls', () => {
    for (const text of ['你好 🌐 café', '\uFEFFhello', '  \n\t', '\0', 'a\r\nb']) {
      const encoded = convertBase64(text, 'encode', 'text');
      expect(convertBase64(encoded.output, 'decode', 'text').output).toBe(text);
    }
    expect(() => convertBase64('\uD800', 'encode', 'text')).toThrow(/Unicode/);
  });
  it('encodes arbitrary bytes and preserves leading zeros in both byte formats', () => {
    expect(convertBase64('00 ff 01', 'encode', 'hex').output).toBe('AP8B');
    expect(convertBase64('AP8B', 'decode', 'hex').output).toBe('00 FF 01');
    expect(convertBase64('AP8B', 'decode', 'binary').output).toBe('00000000 11111111 00000001');
    expect(convertBase64('00000000 11111111 00000001', 'encode', 'binary').output).toBe('AP8B');
    expect(convertBase64('fb ff', 'encode', 'hex').output).toBe('+/8=');
    expect(() => convertBase64('/w==', 'decode', 'text')).toThrow(/UTF-8/);
    expect(convertBase64('/w==', 'decode', 'hex').output).toBe('FF');
  });
  it('round trips every byte value, including all three final block lengths', () => {
    for (let value = 0; value < 256; value++)
      for (let length = 1; length <= 3; length++) {
        const data = Array.from({ length }, (_, i) =>
          ((value + i) % 256).toString(16).padStart(2, '0'),
        ).join(' ');
        const encoded = convertBase64(data, 'encode', 'hex');
        expect(encoded.output).toBe(Buffer.from(encoded.bytes).toString('base64'));
        expect(convertBase64(encoded.output, 'decode', 'hex').output).toBe(data.toUpperCase());
      }
  });
  it.each([
    'Zg',
    'Zg=',
    'Zg===',
    '=Zg=',
    'Z===',
    'Zm9v=',
    'Z g==',
    'Zg==\n',
    '-_8=',
    '!!!!',
    'Zh==',
    'Zm9=',
  ])('rejects malformed or noncanonical input %s', (encoded) =>
    expect(() => convertBase64(encoded, 'decode', 'hex')).toThrow(),
  );
  it('validates byte input boundaries and format choices', () => {
    for (const input of ['0', '0xFF', 'GG', 'FF:00'])
      expect(() => convertBase64(input, 'encode', 'hex')).toThrow();
    for (const input of ['1', '00000002', '0b00000000'])
      expect(() => convertBase64(input, 'encode', 'binary')).toThrow();
    expect(convertBase64('a'.repeat(maxManualBytes), 'encode', 'text').bytes).toHaveLength(
      maxManualBytes,
    );
    expect(() => convertBase64('a'.repeat(maxManualBytes + 1), 'encode', 'text')).toThrow(
      /192 bytes/,
    );
    expect(() => convertBase64('🌐'.repeat(49), 'encode', 'text')).toThrow(/192 bytes/);
    expect(() => convertBase64('AAAA'.repeat(65), 'decode', 'hex')).toThrow(/192 bytes/);
    expect(() => convertBase64('', 'bad' as 'encode', 'text')).toThrow(/encode or decode/);
    expect(() => convertBase64('', 'encode', 'bad' as 'text')).toThrow(/Choose/);
  });
  it('explains padding bits separately from padding characters in both directions', () => {
    for (const direction of ['encode', 'decode'] as const) {
      const conversion = convertBase64(direction === 'encode' ? 'f' : 'Zg==', direction, 'text');
      expect(conversion.groups[0]).toMatchObject({
        bits: '01100110',
        groups: ['011001', '100000'],
        indices: [25, 32],
        padBits: 4,
        padding: 2,
      });
      const lesson = base64Lesson(conversion);
      for (const steps of Object.values(lesson.methods)) {
        expect(steps.at(-1)?.text).toContain(direction === 'encode' ? 'Zg==' : '"f"');
        expect(steps.some((step) => step.content?.some((part) => part.style === 'result'))).toBe(
          true,
        );
      }
      expect(lesson.methods.indices.map((step) => step.text).join('\n')).toContain(
        '0 × 2^5 + 1 × 2^4',
      );
    }
  });
});
