import type { IntegerConversion } from '../calculators/numbers';
import type { Lesson, Step } from './lessons';
export function integerLesson(r: IntegerConversion): Lesson {
  const radix = { decimal: 10, binary: 2, hex: 16 },
    base = radix[r.to === 'decimal' ? r.from : r.to];
  const division: Step[] = [];
  let n = r.value;
  do {
    division.push({
      title: `Divide ${n} by ${base}`,
      text: `${n} ÷ ${base} = ${n / BigInt(base)}, remainder ${(n % BigInt(base)).toString(base).toUpperCase()}`,
    });
    n /= BigInt(base);
  } while (n);
  division.push({
    title: 'Read remainders from bottom to top',
    text:
      r.to === 'decimal'
        ? `This reconstructs ${r.input} in ${r.from}; decimal value ${r.value}.`
        : `Result: ${r.output}`,
  });
  const place = r.input
    .split('')
    .map((d, i) => ({
      title: `Position ${r.input.length - 1 - i}`,
      text: `${d} × ${radix[r.from]}^${r.input.length - 1 - i} = ${BigInt(parseInt(d, radix[r.from])) * BigInt(radix[r.from]) ** BigInt(r.input.length - 1 - i)}`,
    }));
  place.push({
    title: 'Add all contributions',
    text: `Decimal total ${r.value}. ${r.to} result: ${r.output}.`,
  });
  const binary = r.value.toString(2),
    padded = binary.padStart(Math.ceil(binary.length / 4) * 4, '0');
  return {
    title: 'Integer number-system conversion',
    summary: r.output,
    metrics: [
      ['Decimal', String(r.value)],
      ['Hexadecimal', r.value.toString(16).toUpperCase()],
      ['Binary', binary],
      ['Significant binary bits', String(binary.length)],
    ],
    why: 'Use repeated division to write hexadecimal or binary; use positional weights to verify the answer in decimal. Integers are not limited to an IPv4 octet.',
    methods: {
      recommended: r.from === 'decimal' ? division : place,
      division,
      place,
      binary: [
        {
          title: 'Group bits into nibbles',
          text: padded
            .match(/.{4}/g)!
            .map((bits) => `${bits} = ${parseInt(bits, 2).toString(16).toUpperCase()}`)
            .join('\n'),
        },
      ],
      exam: [
        {
          title: 'Conversion and verification',
          text: `${r.input} (${r.from}) = ${r.value} decimal = ${r.value.toString(16).toUpperCase()} hex = ${binary} binary.`,
        },
      ],
    },
  };
}
