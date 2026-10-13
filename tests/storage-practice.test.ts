import { describe, it, expect } from 'vitest';
import { defaults, validateWorkspace } from '../src/app/storage';
import { makeQuestion, topics, checkAnswer } from '../src/calculators/practice';
describe('backups and practice', () => {
  it('rejects unsupported default explanation methods', () => {
    const backup = defaults();
    backup.preferences.method = '__proto__';
    expect(() => validateWorkspace(backup)).toThrow(/preferences/);
  });
  it('roundtrips a versioned backup and rejects malformed data', () => {
    expect(validateWorkspace(JSON.parse(JSON.stringify(defaults())))).toEqual(defaults());
    expect(() => validateWorkspace({ version: 2 })).toThrow();
    expect(() => validateWorkspace({ ...defaults(), saved: [{ id: 'bad' }] })).toThrow();
  });
  it('generates every topic at every difficulty', () => {
    for (const topic of topics)
      for (const difficulty of ['Easy', 'Medium', 'Hard'])
        for (let i = 0; i < 10; i++) {
          const q = makeQuestion(topic, difficulty);
          expect(q.answers.length).toBeGreaterThan(0);
          q.answers.forEach((a) => expect(checkAnswer(a.value, a.value, topic)).toBe(true));
        }
  });
  it('accepts equivalent padding and CIDR answers', () => {
    expect(checkAnswer('101', '00000101', 'Decimal → Binary')).toBe(true);
    expect(checkAnswer('0x0a', '0A', 'Decimal → Hex')).toBe(true);
    expect(checkAnswer('27', '/27', 'Hosts → CIDR')).toBe(true);
    expect(checkAnswer('2', '00000010', 'Decimal → Binary')).toBe(false);
  });
  it('builds custom VLSM with deterministic answers', () => {
    const q = makeQuestion('VLSM', 'Custom', {
      ip: '10.0.0.0',
      prefix: '/24',
      hosts: 22,
      nextHop: '10.0.0.1',
      requirements: [{ name: 'HQ', hosts: 22, mode: 'lan' }],
    });
    expect(q.answers[0].value).toBe('10.0.0.0/27');
  });
});
