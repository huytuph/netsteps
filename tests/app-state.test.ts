import { describe, expect, it } from 'vitest';
import { DraftStore } from '../src/app/drafts';
import { defaults, entry, validateWorkspace } from '../src/app/storage';
import { mergeHistory, mergeWorkspace } from '../src/app/history';
import { createAppState, resetResult } from '../src/app/state';
import { requiredNumber, choice } from '../src/pages/inputs';
import { commandLesson } from '../src/explanations/commands';
import { dynamicNatLesson } from '../src/explanations/wan';
import { dynamicNat } from '../src/calculators/dynamic-nat';

describe('independent tool drafts', () => {
  it('keeps IPv6 planner and OSPF values, row counts, order and deletion separate', () => {
    const store = new DraftStore();
    store.switchMode('IPv6', 'plan');
    store.capture('IPv6', { mode: 'ospf', base: '2001:db8::/48' }, [
      { name: 'LAN A', prefix: '64', locked: '' },
      { name: 'LAN B', prefix: '64', locked: '' },
    ]);
    expect(store.get('IPv6').values.mode).toBe('plan');
    store.switchMode('IPv6', 'ospf');
    expect(store.get('IPv6').rows).toEqual([
      { router: '', routerId: '', iface: '', address: '', area: '', passive: '' },
    ]);
    store.capture('IPv6', { ospfProcess: '1' }, [{ router: 'R1', iface: 'Gi0/0', passive: '' }]);
    store.get('IPv6').rows.splice(0, 1);
    store.switchMode('IPv6', 'plan');
    expect(store.get('IPv6').rows.map((r) => r.name)).toEqual(['LAN A', 'LAN B']);
    expect(store.get('IPv6').values.base).toBe('2001:db8::/48');
    store.get('IPv6').rows.reverse();
    store.switchMode('IPv6', 'ospf');
    expect(store.get('IPv6').rows).toEqual([]);
    expect(store.get('IPv6').values.ospfProcess).toBe('1');
    store.reset('IPv6');
    expect(store.get('IPv6').rows).toHaveLength(1);
    store.switchMode('IPv6', 'plan');
    expect(store.get('IPv6').rows.map((r) => r.name)).toEqual(['LAN B', 'LAN A']);
  });
  it('restores legacy version-1 scenarios without aliasing their rows', () => {
    const saved = entry(
      'IPv6',
      { mode: 'ospf', ospfProcess: '20' },
      [{ router: 'R1' }],
      'OSPF',
      'Saved',
    );
    const backup = defaults();
    backup.saved = [saved];
    const store = new DraftStore();
    store.restore(validateWorkspace(JSON.parse(JSON.stringify(backup))).saved[0]);
    expect(store.mode('IPv6')).toBe('ospf');
    expect(store.get('IPv6').values.ospfProcess).toBe('20');
    store.get('IPv6').rows[0].router = 'R2';
    expect(saved.rows[0].router).toBe('R1');
    store.clear();
    expect(store.get('IPv6').values.address).toBe('');
  });
});

describe('history retention and imports', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({
    ...entry('Subnetting', {}, [], `Calculation ${i}`, ''),
    id: String(i),
    date: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
  }));
  it('keeps the newest 100 regardless of input order and deduplicates by ID', () => {
    const duplicate = { ...rows[149], name: 'Imported title' };
    const result = mergeHistory(rows.slice(0, 100), [...rows.slice(100).reverse(), duplicate]);
    expect(result).toHaveLength(100);
    expect(result[0].id).toBe('149');
    expect(result[0].name).toBe('Imported title');
    expect(result.at(-1)?.id).toBe('50');
    expect(new Set(result.map((e) => e.id)).size).toBe(100);
  });
  it('applies the same retention rule to loading backups and importing workspaces', () => {
    const current = defaults(),
      incoming = defaults();
    current.history = rows.slice(50);
    incoming.history = rows.slice(0, 75);
    incoming.saved = [rows[0]];
    current.saved = [rows[1]];
    incoming.preferences.theme = 'dark';
    const merged = mergeWorkspace(current, incoming);
    expect(merged.history.map((e) => e.id)).toEqual(mergeHistory([], rows).map((e) => e.id));
    expect(validateWorkspace({ ...defaults(), history: rows }).history).toEqual(
      mergeHistory([], rows),
    );
    expect(merged.saved).toHaveLength(2);
    expect(current.saved).toHaveLength(1);
    expect(merged.preferences.theme).toBe('dark');
  });
});

describe('result lifecycle and shared validation', () => {
  it('clears question, result, snapshot, scenario, hints and feedback together', () => {
    const state = createAppState(defaults());
    Object.assign(state, {
      scenarioName: 'Old scenario',
      hintCount: 3,
      answerRevealed: true,
      practiceCounted: true,
      practiceAnswers: { 'answer-0': 'old' },
      practiceFeedback: ['Correct'],
      stale: true,
      error: 'Old error',
    });
    state.method = 'commands';
    state.hintMode = true;
    resetResult(state, true);
    expect(state).toEqual(createAppState(defaults()));
  });
  it('distinguishes blank, nonfinite and valid numeric inputs and rejects unsupported choices', () => {
    expect(() => requiredNumber('', 'Required hosts')).toThrow(/Enter required hosts/);
    expect(() => requiredNumber('Infinity', 'Required hosts')).toThrow(/finite/);
    expect(() => requiredNumber('abc', 'Required hosts')).toThrow(/finite/);
    expect(requiredNumber('0', 'Process')).toBe(0);
    expect(choice('lan', ['lan', 'p2p'], 'address mode')).toBe('lan');
    expect(() => choice('invalid', ['lan', 'p2p'], 'address mode')).toThrow(/address mode/);
  });
});

describe('shared command explanations', () => {
  it('explains each command while retaining recommended steps, summary and warnings', () => {
    const lesson = commandLesson(
      'Example',
      [['Count', '2']],
      '! comment\n  ! indented\ninterface Gi0/0\n no shutdown\n',
      [{ title: 'Plan', text: 'Choose an interface' }],
      'Plan first',
      undefined,
      undefined,
      { summary: 'Custom', warnings: ['Check cabling'] },
    );
    expect(lesson.methods.commands).toHaveLength(2);
    expect(lesson.methods.commands[1].text).toContain('Enable the interface');
    expect(lesson.methods.recommended[0].title).toBe('Plan');
    expect(lesson.summary).toBe('Custom');
    expect(lesson.warnings).toEqual(['Check cabling']);
  });
  it('explains pool NAT as separate translations rather than PAT overload', () => {
    const lesson = dynamicNatLesson(
      dynamicNat({
        networks: ['10.0.0.0/24'],
        pool: 'POOL',
        start: '203.0.113.10',
        end: '203.0.113.20',
        prefix: '/24',
        acl: 1,
        inside: 'Gi0/0',
        outside: 'Gi0/1',
      }),
    );
    expect(
      lesson.methods.commands.find((s) => s.text.startsWith('ip nat inside source'))?.text,
    ).toContain('separate addresses');
    expect(lesson.methods.commands).not.toEqual(lesson.methods.recommended);
  });
});
