import { describe, expect, it } from 'vitest';
import { createAppState } from '../src/app/state';
import { defaults } from '../src/app/storage';
import { createViews } from '../src/app/views';
import { baseValues, initialRows } from '../src/pages/forms';
import { convertInteger } from '../src/calculators/numbers';
import { integerLesson } from '../src/explanations/integer';
import { resolveMethod } from '../src/explanations/methods';
import { makeQuestion } from '../src/calculators/practice';
import { questionLesson } from '../src/explanations/lessons';

describe('read-only rendering', () => {
  it.each(['commands', '__proto__', 'toString'])(
    'renders and exports a safe fallback for %s without mutating state',
    (requested) => {
      const state = createAppState(defaults());
      state.tab = 'Number Systems';
      state.method = requested;
      state.lesson = integerLesson(convertInteger('567', 'decimal', 'hex'));
      const draft = {
        values: { ...baseValues['Number Systems']! },
        rows: initialRows('Number Systems'),
      };
      const before = structuredClone(state);
      const views = createViews(Object.freeze(state), () => draft);
      expect(views.workspacePage()).toContain('value="recommended" selected');
      expect(views.resultOutput()).toContain('Result: 237');
      expect(views.outputText()).toContain('Manual working (Recommended / Easiest)');
      expect(state).toEqual(before);
    },
  );
  it('keeps a supported method and its working consistent across repeated renders and exports', () => {
    const state = createAppState(defaults());
    state.lesson = integerLesson(convertInteger('567', 'decimal', 'hex'));
    state.method = 'place';
    const before = structuredClone(state);
    const views = createViews(Object.freeze(state), () => ({ values: {}, rows: [] }));
    expect(resolveMethod(state.lesson, 'place')).toBe('place');
    expect(views.resultOutput()).toBe(views.resultOutput());
    expect(views.outputText('working')).toContain('5 × 10^2 = 500');
    expect(views.outputText()).toContain('Manual working (Place Value)');
    expect(state).toEqual(before);
  });
  it('renders practice working without changing the question, answers or hint state', () => {
    const state = createAppState(defaults());
    state.tab = 'Practice';
    state.question = makeQuestion('Network address', 'Easy');
    state.practiceLesson = questionLesson(state.question);
    state.method = 'unsupported';
    state.hintCount = 1;
    state.practiceAnswers = { 'answer-0': '192.0.2.0' };
    const before = structuredClone(state);
    const views = createViews(Object.freeze(state), () => ({ values: {}, rows: [] }));
    expect(views.practiceOutput()).toContain('192.0.2.0');
    expect(state).toEqual(before);
  });
});
