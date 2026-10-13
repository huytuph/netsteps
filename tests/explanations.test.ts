import { describe, it, expect } from 'vitest';
import { makeQuestion, topics } from '../src/calculators/practice';
import { questionLesson, subnetLesson, vlsmLesson } from '../src/explanations/lessons';
import { subnet } from '../src/calculators/ipv4';
import { planVlsm } from '../src/calculators/vlsm';
describe('manual explanation correctness', () => {
  it('provides working without parsing question prose', () => {
    for (const topic of topics) {
      const q = makeQuestion(topic, 'Hard');
      q.prompt = 'Unrelated display text';
      expect(questionLesson(q).methods.recommended.length).toBeGreaterThan(0);
    }
  });
  it('shows reproducible subnet arithmetic and wildcard subtraction', () => {
    const l = subnetLesson(subnet('172.81.42.50', 27));
    const text = l.methods.recommended.map((x) => x.text).join('\n');
    expect(text).toContain('256 − 224 = 32');
    expect(text).toContain('floor(50 ÷ 32) × 32 = 32');
    expect(text).toContain('Wildcard = 0.0.0.31');
  });
  it('explains why oversized locks retain capacity', () => {
    const l = vlsmLesson(
      planVlsm('10.0.0.0/24', [{ name: 'HQ', hosts: 2, mode: 'lan', locked: '10.0.0.0/26' }]),
    );
    expect(l.methods.recommended[0].text).toContain('retained');
    expect(l.methods.formula[0].text).toContain('Locked block');
  });
});
