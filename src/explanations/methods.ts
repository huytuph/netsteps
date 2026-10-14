import type { Lesson } from './model';
export function resolveMethod(lesson: Lesson, requested: string): string {
  return Object.hasOwn(lesson.methods, requested) ? requested : 'recommended';
}
export const methodLabels: Record<string, string> = {
  recommended: 'Recommended / Easiest',
  division: 'Division / Remainder',
  place: 'Place Value',
  powers: 'Powers of Two',
  formula: 'Formula',
  binary: 'Binary',
  and: 'Bitwise AND',
  block: 'Block Size',
  connected: 'Connected Networks',
  commands: 'Command by Command',
  exam: 'Short Exam Method',
};
export function methodWhy(lesson: Lesson, method: string): string {
  return (
    (
      {
        division:
          'Repeated division produces one digit at a time. Reading remainders in reverse reconstructs the value in the chosen base.',
        place: 'Multiplying each digit by its positional weight makes every contribution visible.',
        powers:
          'Powers of two connect bit positions to address capacity and help you reproduce the result by hand.',
        formula:
          'The formula expresses the boundary or capacity rule directly, so you can substitute the input values.',
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
