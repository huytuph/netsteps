import { base64Alphabet, type Base64Conversion } from '../calculators/base64';
import { emphasis, formattedStep as step, inputValue, note, result, rule } from './format';
import type { Lesson, Step } from './model';

const hexBytes = (bytes: number[]) =>
  bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const byteBits = (bytes: number[]) =>
  bytes.map((byte) => byte.toString(2).padStart(8, '0')).join(' ');
export function base64Lesson(r: Base64Conversion): Lesson {
  const decoding = r.direction === 'decode';
  const displayedOutput = decoding && r.format === 'text' ? JSON.stringify(r.output) : r.output;
  const start = step(
    decoding ? 'Read the Base64 characters' : 'Read the input as bytes',
    inputValue(JSON.stringify(r.input)),
    '\n',
    rule(
      decoding
        ? 'Each non-padding Base64 character selects an index from 0 to 63.'
        : r.format === 'text'
          ? 'Encode text as UTF-8 first. One character can occupy multiple bytes.'
          : r.format === 'hex'
            ? 'Each pair of hexadecimal digits represents one byte.'
            : 'Each group of eight binary digits represents one byte.',
    ),
    '\n',
    decoding ? '' : 'Hexadecimal bytes: ',
    decoding ? '' : emphasis(hexBytes(r.bytes)),
  );
  const final = step(
    'Final result',
    result(displayedOutput),
    '\n',
    note(
      decoding && r.format === 'text'
        ? 'Quotes show the text boundary; escape sequences make whitespace and control characters visible.'
        : decoding
          ? 'Keep all eight bits per byte, including leading zeros.'
          : 'Keep the alphabet case and any = padding exactly as shown.',
    ),
  );
  const alphabet = step(
    'Standard Base64 alphabet',
    rule('Look up the character at its zero-based index. The = sign is padding, not index 64.\n'),
    ...Array.from(
      { length: 8 },
      (_, row) =>
        Array.from(
          { length: 8 },
          (_, col) => `${row * 8 + col}: ${base64Alphabet[row * 8 + col]}`,
        ).join('   ') + '\n',
    ),
  );

  function manual(method: 'grouping' | 'lookup' | 'indices'): Step[] {
    const steps: Step[] = [start];
    if (method === 'lookup') steps.push(alphabet);
    r.groups.forEach((group, i) => {
      const label = `Block ${i + 1}`;
      if (decoding) {
        steps.push(
          step(
            `${label} · Look up each character`,
            inputValue(group.encoded),
            '\n',
            ...group.indices.flatMap((index) => [
              inputValue(base64Alphabet[index]),
              ' → index ',
              emphasis(String(index)),
              ' → ',
              result(index.toString(2).padStart(6, '0')),
              '\n',
            ]),
          ),
        );
      } else {
        steps.push(
          step(
            `${label} · Write up to three 8-bit bytes`,
            inputValue(hexBytes(group.bytes)),
            ' (hex)\n',
            emphasis(byteBits(group.bytes)),
            '\n',
            rule('Concatenate bytes from left to right.'),
            '\n',
            emphasis(group.bits),
          ),
        );
      }
      if (method === 'indices') {
        group.groups.forEach((bits, j) => {
          const terms = [...bits].map((bit, k) => `${bit} × 2^${5 - k}`).join(' + ');
          steps.push(
            step(
              `${label} · Calculate index ${j + 1}`,
              inputValue(bits),
              '\n',
              terms,
              ' = ',
              result(String(group.indices[j])),
              '\nAlphabet[',
              emphasis(String(group.indices[j])),
              '] = ',
              result(base64Alphabet[group.indices[j]]),
            ),
          );
        });
      }
      if (decoding) {
        steps.push(
          step(
            `${label} · Rebuild the bytes`,
            rule(
              'Concatenate the six-bit groups, then discard only the unused zero padding bits.\n',
            ),
            inputValue(group.groups.join(' ')),
            '\n',
            `${group.padding} trailing = sign(s) → discard ${group.padBits} unused zero bit(s).\n`,
            emphasis(byteBits(group.bytes)),
            ' → ',
            result(hexBytes(group.bytes)),
            ' (hex)',
          ),
        );
      } else {
        steps.push(
          step(
            `${label} · Split into six-bit groups`,
            rule('Split from the left. If the final group is short, add zero bits on the right.\n'),
            `${group.padBits} zero bit(s) added → `,
            emphasis(group.groups.join(' ')),
            '\n',
            ...group.groups.flatMap((bits, j) => [
              inputValue(bits),
              ' → ',
              emphasis(String(group.indices[j])),
              ' → ',
              result(base64Alphabet[group.indices[j]]),
              '\n',
            ]),
          ),
        );
        steps.push(
          step(
            `${label} · Complete the output quartet`,
            rule('Three bytes produce four characters; one byte needs == and two bytes need =.\n'),
            `${group.bytes.length} byte(s) → ${group.padding} padding character(s).\n`,
            result(group.encoded),
          ),
        );
      }
    });
    if (decoding)
      steps.push(
        step(
          'Write the requested byte format',
          inputValue(hexBytes(r.bytes)),
          ' (hex)\n',
          rule(
            r.format === 'text'
              ? 'Decode the reconstructed bytes as UTF-8. Invalid UTF-8 must be viewed as hex or binary.'
              : r.format === 'hex'
                ? 'Write two hexadecimal digits per byte.'
                : 'Write eight binary digits per byte.',
          ),
        ),
      );
    steps.push(final);
    return steps;
  }
  const grouping = manual('grouping');
  return {
    title: `Base64 ${decoding ? 'decoding' : 'encoding'}`,
    summary: r.output,
    metrics: [
      [
        decoding ? (r.format === 'text' ? 'Decoded text (quoted)' : 'Decoded bytes') : 'Base64',
        displayedOutput,
      ],
      ['Byte count', String(r.bytes.length)],
      ['Hexadecimal bytes', hexBytes(r.bytes)],
      ['Binary bytes', byteBits(r.bytes)],
      ['Base64 characters', String(r.encoded.length)],
      ['Padding characters', String(r.groups.at(-1)?.padding || 0)],
    ],
    columns: [
      'Block',
      'Hex bytes',
      '8-bit bytes',
      '6-bit groups',
      'Indices',
      'Base64',
      '= padding',
    ],
    rows: r.groups.map((group, i) => [
      String(i + 1),
      hexBytes(group.bytes),
      byteBits(group.bytes),
      group.groups.join(' '),
      group.indices.join(', '),
      group.encoded,
      String(group.padding),
    ]),
    why: 'Base64 represents bytes as text: regroup eight-bit bytes into six-bit alphabet indices. Encoding adds zero bits and = padding when needed; decoding reverses the process.',
    methods: {
      recommended: grouping,
      grouping,
      lookup: manual('lookup'),
      indices: manual('indices'),
      exam: [
        step(
          'Byte / character relationship',
          rule('8-bit bytes ↔ 6-bit indices ↔ Base64 alphabet.\n'),
          inputValue(hexBytes(r.bytes)),
          ' (hex) ↔ ',
          emphasis(r.encoded),
          `\n${r.bytes.length} bytes; ${r.groups.at(-1)?.padding || 0} padding character(s).`,
        ),
        final,
      ],
    },
  };
}
