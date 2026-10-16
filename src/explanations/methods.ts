import type { Lesson } from './model';
export function resolveMethod(lesson: Lesson, requested: string): string {
  return Object.hasOwn(lesson.methods, requested) ? requested : 'recommended';
}
export const methodLabels: Record<string, string> = {
  recommended: 'Recommended / Easiest',
  division: 'Division / Remainder',
  place: 'Place Value',
  expansion: 'Positional Expansion',
  powers: 'Powers of Two',
  three: 'Three-Bit Grouping',
  four: 'Four-Bit Grouping',
  lookup: 'Alphabet Lookup Table',
  grouping: 'Binary Grouping',
  indices: 'Index Calculation',
  formula: 'Formula',
  binary: 'Binary',
  and: 'Bitwise AND',
  block: 'Block Size',
  connected: 'Connected Networks',
  commands: 'Command by Command',
  exam: 'Short Exam Method',
};
export function methodOptions(methods: readonly string[]): [string, string][] {
  return methods
    .map((method): [string, string] => [
      method,
      Object.hasOwn(methodLabels, method) ? methodLabels[method] : method,
    ])
    .sort(([, a], [, b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
export function methodWhy(lesson: Lesson, method: string): string {
  return (
    (
      {
        division:
          'Repeated division produces one digit at a time. Reading remainders in reverse reconstructs the value in the chosen base.',
        place: 'Multiplying each digit by its positional weight makes every contribution visible.',
        expansion:
          'Write the entire positional sum first, then evaluate each digit × base^position to find the decimal value.',
        powers:
          'Powers of two connect bit positions to address capacity and help you reproduce the result by hand.',
        formula:
          'The formula expresses the boundary or capacity rule directly, so you can substitute the input values.',
        three:
          'Each octal digit corresponds to three binary bits. Group from the right and add leading zeros only when needed.',
        four: 'Each hexadecimal digit corresponds to four binary bits. Expand or regroup bits to preserve the value.',
        grouping:
          'Base64 regroups 8-bit bytes into 6-bit indices. The final group may need zero bits and = padding.',
        lookup:
          'The standard Base64 alphabet maps indices 0–63 to characters. Padding is a length marker, not a data character.',
        indices:
          'Positional weights convert each six-bit group to an alphabet index; decoding reconstructs bytes from those indices.',
        binary:
          'Binary exposes the network and host bits. Four-bit groups also map directly to hexadecimal digits.',
        and: 'Bitwise AND keeps only positions that are 1 in both the address and the mask.',
        block:
          'Subtract the changing mask octet from 256, then locate the nearest lower block boundary.',
        connected:
          'List connected networks first so you can distinguish local destinations from networks that need a route.',
        commands:
          'Reading each command with its purpose connects the address plan to the configuration.',
        exam: 'This compact method retains the essential arithmetic and final answer for quick revision.',
      } as Record<string, string>
    )[method] || lesson.why
  );
}
