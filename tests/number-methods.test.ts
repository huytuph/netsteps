// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { convertInteger, numberBases } from '../src/calculators/numbers';
import { integerLesson } from '../src/explanations/integer';
import { formattedStep, inputValue, rule, result } from '../src/explanations/format';
import { methodOptions } from '../src/explanations/methods';
import { renderStepText } from '../src/components/explanation';

describe('number methodologies and semantic formatting', () => {
  it('finishes every methodology for every base pair, including zero and leading zeros', () => {
    for (const value of [0, 1, 8, 493, 567])
      for (const from of numberBases)
        for (const to of numberBases) {
          const digits = convertInteger(String(value), 'decimal', from).output;
          const conversion = convertInteger('000' + digits, from, to);
          const lesson = integerLesson(conversion);
          for (const steps of Object.values(lesson.methods)) {
            expect(steps.at(-1)?.text).toContain(conversion.output);
            for (const step of steps) {
              const node = document.createElement('div');
              node.innerHTML = renderStepText(step);
              expect(node.textContent).toBe(step.text);
            }
          }
          const labels = methodOptions(Object.keys(lesson.methods)).map(([, label]) => label);
          expect(labels).toEqual(
            [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
          );
        }
  });
  it('selects direct grouping as easiest for binary/octal and binary/hex', () => {
    const octal = integerLesson(convertInteger('101010', 'binary', 'octal'));
    expect(octal.methods.recommended).toBe(octal.methods.three);
    expect(octal.methods.three.map((s) => s.text).join('\n')).toContain('101 → 5');
    const hex = integerLesson(convertInteger('AF', 'hex', 'binary'));
    expect(hex.methods.recommended).toBe(hex.methods.four);
    expect(hex.methods.four.map((s) => s.text).join('\n')).toContain('A → 1010');
  });
  it('escapes rich and legacy text without treating entered HTML or Markdown as formatting', () => {
    const malicious = '<img src=x onerror="alert(1)"> **value** & <script>bad()</script>';
    const step = formattedStep(
      'Safe text',
      inputValue(malicious),
      '\n',
      rule('A rule'),
      '\n',
      result('42'),
    );
    const node = document.createElement('div');
    node.innerHTML = renderStepText(step);
    expect(node.querySelector('img,script')).toBeNull();
    expect(node.textContent).toBe(step.text);
    expect(node.querySelector('mark')?.textContent).toBe(malicious);
    expect(node.querySelector('em')?.textContent).toBe('A rule');
    expect(node.querySelector('strong u')?.textContent).toBe('42');
    node.innerHTML = renderStepText({ title: 'Legacy', text: malicious + ' 192.0.2.1/24' });
    expect(node.querySelector('img,script')).toBeNull();
    expect(node.textContent).toBe(malicious + ' 192.0.2.1/24');
  });
});
