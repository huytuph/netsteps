export const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export type ByteFormat = 'text' | 'hex' | 'binary';
export type Base64Direction = 'encode' | 'decode';
export const maxManualBytes = 192;
export interface Base64Group {
  bytes: number[];
  bits: string;
  groups: string[];
  indices: number[];
  encoded: string;
  padBits: number;
  padding: number;
}
export interface Base64Conversion {
  input: string;
  direction: Base64Direction;
  format: ByteFormat;
  bytes: number[];
  encoded: string;
  output: string;
  groups: Base64Group[];
}
function checkSize(length: number): void {
  if (length > maxManualBytes)
    throw new Error(`Use at most ${maxManualBytes} bytes for manual working.`);
}
function readBytes(input: string, format: ByteFormat): number[] {
  if (input.length > maxManualBytes * 12) checkSize(maxManualBytes + 1);
  if (format === 'text') {
    for (const character of input) {
      if (character.length === 1 && /[\uD800-\uDFFF]/.test(character))
        throw new Error('Text contains an incomplete Unicode character.');
    }
    const bytes = [...new TextEncoder().encode(input)];
    checkSize(bytes.length);
    return bytes;
  }
  const digits = input.replace(/[\t\r\n ]/g, '');
  const width = format === 'hex' ? 2 : 8;
  if (!(format === 'hex' ? /^[\dA-Fa-f]*$/ : /^[01]*$/).test(digits) || digits.length % width)
    throw new Error(
      format === 'hex'
        ? 'Hexadecimal byte data needs complete pairs of 0–9 / A–F; spaces are allowed.'
        : 'Binary byte data needs complete groups of 8 bits; spaces are allowed.',
    );
  checkSize(digits.length / width);
  return (digits.match(new RegExp(`.{${width}}`, 'g')) || []).map((part) =>
    parseInt(part, format === 'hex' ? 16 : 2),
  );
}
function groupBytes(bytes: number[]): Base64Group[] {
  const groups: Base64Group[] = [];
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const block = bytes.slice(offset, offset + 3);
    const bits = block.map((byte) => byte.toString(2).padStart(8, '0')).join('');
    const padBits = (6 - (bits.length % 6)) % 6;
    const sixes = (bits + '0'.repeat(padBits)).match(/.{6}/g)!;
    const indices = sixes.map((six) => parseInt(six, 2));
    const padding = 3 - block.length;
    groups.push({
      bytes: block,
      bits,
      groups: sixes,
      indices,
      encoded: indices.map((index) => base64Alphabet[index]).join('') + '='.repeat(padding),
      padBits,
      padding,
    });
  }
  return groups;
}
export function convertBase64(
  input: string,
  direction: Base64Direction,
  format: ByteFormat,
): Base64Conversion {
  if (direction !== 'encode' && direction !== 'decode') throw new Error('Choose encode or decode.');
  if (!['text', 'hex', 'binary'].includes(format))
    throw new Error('Choose text, hexadecimal bytes or binary bytes.');
  let bytes: number[];
  if (direction === 'encode') bytes = readBytes(input, format);
  else {
    if (input.length > Math.ceil(maxManualBytes / 3) * 4) checkSize(maxManualBytes + 1);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input))
      throw new Error(
        'Enter standard Base64 using A–Z, a–z, 0–9, + and /, with correct trailing = padding and no whitespace.',
      );
    bytes = [];
    for (let offset = 0; offset < input.length; offset += 4) {
      const quartet = input.slice(offset, offset + 4);
      const bits = [...quartet.replace(/=/g, '')]
        .map((character) => base64Alphabet.indexOf(character).toString(2).padStart(6, '0'))
        .join('');
      for (let bit = 0; bit + 8 <= bits.length; bit += 8)
        bytes.push(parseInt(bits.slice(bit, bit + 8), 2));
    }
    if (
      groupBytes(bytes)
        .map((group) => group.encoded)
        .join('') !== input
    )
      throw new Error('Noncanonical Base64: unused padding bits must be zero.');
  }
  const groups = groupBytes(bytes);
  const encoded = groups.map((group) => group.encoded).join('');
  let output = encoded;
  if (direction === 'decode') {
    if (format === 'text') {
      try {
        output = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          new Uint8Array(bytes),
        );
      } catch {
        throw new Error(
          'Decoded bytes are not valid UTF-8 text. Select hexadecimal or binary byte output.',
        );
      }
    } else
      output = bytes
        .map((byte) =>
          byte
            .toString(format === 'hex' ? 16 : 2)
            .toUpperCase()
            .padStart(format === 'hex' ? 2 : 8, '0'),
        )
        .join(' ');
  }
  return { input, direction, format, bytes, encoded, output, groups };
}
