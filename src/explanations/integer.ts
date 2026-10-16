import { baseNames, radix, type IntegerConversion, type NumberBase } from '../calculators/numbers';
import { emphasis, formattedStep as step, inputValue, note, result, rule } from './format';
import type { Lesson, Step } from './model';

export function integerLesson(r: IntegerConversion, octet = false): Lesson {
  const binary = r.value.toString(2);
  const final = step(
    'Final conversion',
    inputValue(`${r.input} (base ${radix[r.from]})`),
    ' = ',
    result(`${r.output} (base ${radix[r.to]})`),
  );
  const significant = r.input.replace(/^0+(?=.)/, '');
  const place: Step[] = significant.split('').map((digit, i) => {
    const position = significant.length - 1 - i;
    const value = parseInt(digit, radix[r.from]);
    return step(
      `Position ${position}`,
      inputValue(digit),
      ` × ${radix[r.from]}^${position} = `,
      emphasis(String(BigInt(value) * BigInt(radix[r.from]) ** BigInt(position))),
    );
  });
  if (r.from === 'hex' && /[A-F]/.test(significant))
    place.unshift(
      step(
        'Read hexadecimal letter digits',
        rule('A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.\n'),
        note('Use these decimal digit values when evaluating the positional weights.'),
      ),
    );
  place.push(
    step(
      'Add all contributions',
      rule('Add digit × base^position for each position, starting at 0 on the right.\n'),
      significant
        .split('')
        .map((digit, i) =>
          String(
            BigInt(parseInt(digit, radix[r.from])) *
              BigInt(radix[r.from]) ** BigInt(significant.length - 1 - i),
          ),
        )
        .join(' + '),
      ' = ',
      result(String(r.value)),
      ' decimal.',
    ),
  );

  function divide(base: number): Step[] {
    const steps: Step[] = [];
    let n = r.value;
    do {
      const remainder = n % BigInt(base);
      const digit = remainder.toString(base).toUpperCase();
      steps.push(
        step(
          `Divide ${n} by ${base}`,
          inputValue(String(n)),
          ` ÷ ${base} = `,
          emphasis(String(n / BigInt(base))),
          ', remainder ',
          result(digit),
          remainder >= 10n ? ` (${remainder} decimal = ${digit})` : '',
        ),
      );
      n /= BigInt(base);
    } while (n);
    steps.push(
      step(
        'Read remainders from bottom to top',
        rule('Reverse the remainders to get the most significant digit first.\n'),
        result(r.value.toString(base).toUpperCase()),
        ` (base ${base}).`,
        octet && r.to !== 'decimal' ? note(` Left-pad with zeros if selected: ${r.output}.`) : '',
      ),
    );
    return steps;
  }
  const targetDivision = r.to === 'decimal' ? [] : divide(radix[r.to]);
  const placeMethod = [...place, ...targetDivision, final];
  const expansion = [
    step(
      'Expand the positional formula',
      rule('Write the complete sum of digit × base^position, then evaluate the terms.\n'),
      inputValue(r.input),
      ' = ',
      significant
        .split('')
        .map((digit, i) => `${digit} × ${radix[r.from]}^${significant.length - 1 - i}`)
        .join(' + '),
      '\nDecimal total = ',
      result(String(r.value)),
    ),
    ...targetDivision,
    final,
  ];
  const division = [
    ...(r.from === 'decimal' ? [] : place),
    ...divide(r.to === 'decimal' ? radix[r.from] : radix[r.to]),
    final,
  ];
  const powers: Step[] = [
    step(
      'Use binary positional weights',
      rule('Each bit is a power of two. Work from the largest weight down to 1.'),
    ),
  ];
  let remaining = r.value;
  for (let position = (octet ? 8 : binary.length) - 1; position >= 0; position--) {
    const weight = 1n << BigInt(position);
    const bit = remaining >= weight ? 1 : 0;
    if (bit) remaining -= weight;
    powers.push(
      step(
        `2^${position} = ${weight}`,
        bit ? 'Use ' : 'Skip ',
        inputValue(String(weight)),
        ' → bit ',
        emphasis(String(bit)),
        ', remainder ',
        emphasis(String(remaining)),
        '.',
      ),
    );
  }
  powers.push(
    step(
      'Read the bits',
      result(octet ? binary.padStart(8, '0') : binary),
      ' binary = ',
      emphasis(String(r.value)),
      ' decimal.',
    ),
  );
  const powersMethod = [
    ...(r.from === 'binary' ? place : [...(r.from === 'decimal' ? [] : place), ...powers]),
    ...(r.to === 'hex' || r.to === 'octal' ? targetDivision : []),
    final,
  ];

  function grouping(width: 3 | 4): Step[] {
    const groupedBase: NumberBase = width === 3 ? 'octal' : 'hex';
    const steps: Step[] = [
      step(
        `Use ${width}-bit groups`,
        rule(
          `One ${baseNames[groupedBase].toLowerCase()} digit represents exactly ${width} bits because 2^${width} = ${radix[groupedBase]}.`,
        ),
      ),
    ];
    if (r.from === 'decimal') steps.push(...powers);
    else if (r.from === 'octal' || r.from === 'hex') {
      const sourceWidth = r.from === 'octal' ? 3 : 4;
      steps.push(
        step(
          'Expand the source digits to binary',
          ...significant
            .split('')
            .flatMap((digit) => [
              inputValue(digit),
              ' → ',
              emphasis(parseInt(digit, radix[r.from]).toString(2).padStart(sourceWidth, '0')),
              '\n',
            ]),
          note('Concatenate the groups; leading zeros do not change the numeric value.'),
        ),
      );
    } else steps.push(step('Keep the source bits', inputValue(r.input), ' → ', emphasis(binary)));
    const padded = binary.padStart(Math.ceil(binary.length / width) * width, '0');
    steps.push(
      step(
        'Group from the right',
        rule('Add leading zeros on the left only to complete the first group.\n'),
        emphasis(padded.match(new RegExp(`.{${width}}`, 'g'))!.join(' ')),
      ),
    );
    steps.push(
      step(
        'Map each group to one digit',
        ...padded
          .match(new RegExp(`.{${width}}`, 'g'))!
          .flatMap((bits) => [
            inputValue(bits),
            ' → ',
            result(parseInt(bits, 2).toString(radix[groupedBase]).toUpperCase()),
            '\n',
          ]),
        `${baseNames[groupedBase]}: `,
        result(r.value.toString(radix[groupedBase]).toUpperCase()),
      ),
    );
    if (r.to === 'decimal') steps.push(...place);
    else if (r.to !== 'binary' && r.to !== groupedBase) steps.push(...targetDivision);
    steps.push(final);
    return steps;
  }
  const methods: Record<string, Step[]> = {
    recommended: r.from === 'decimal' ? division : placeMethod,
    division,
    place: placeMethod,
    expansion,
    exam: [
      step(
        'Conversion and verification',
        inputValue(`${r.input} (${r.from})`),
        ' = ',
        emphasis(`${r.value} decimal`),
        ' = ',
        result(`${r.output} (${r.to})`),
      ),
    ],
  };
  if (r.from === 'binary' || r.to === 'binary') methods.powers = powersMethod;
  if (r.from === 'octal' || r.to === 'octal') methods.three = grouping(3);
  if (r.from === 'hex' || r.to === 'hex') methods.four = grouping(4);
  if ((r.from === 'binary' && r.to === 'octal') || (r.from === 'octal' && r.to === 'binary'))
    methods.recommended = methods.three;
  if ((r.from === 'binary' && r.to === 'hex') || (r.from === 'hex' && r.to === 'binary'))
    methods.recommended = methods.four;
  if ((r.from === 'octal' && r.to === 'hex') || (r.from === 'hex' && r.to === 'octal'))
    methods.recommended = grouping(r.to === 'octal' ? 3 : 4);
  return {
    title: octet ? 'Octet conversion' : 'Integer number-system conversion',
    summary: r.output,
    metrics: [
      ['Decimal', String(r.value)],
      ['Binary', octet ? binary.padStart(8, '0') : binary],
      ['Octal', r.value.toString(8).padStart(octet ? 3 : 1, '0')],
      [
        'Hexadecimal',
        r.value
          .toString(16)
          .toUpperCase()
          .padStart(octet ? 2 : 1, '0'),
      ],
      ['Significant binary bits', String(binary.length)],
    ],
    why: 'Read a source using place values, write a target using repeated division, or group three bits for octal and four for hexadecimal. Leading zeros preserve the value.',
    methods,
  };
}
