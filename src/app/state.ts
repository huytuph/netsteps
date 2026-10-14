import type { Question } from '../calculators/practice';
import type { Lesson } from '../explanations/model';
import type { Preferences, Tab, Values, Workspace } from './storage';

export interface Draft {
  values: Values;
  rows: Values[];
}
export interface AppState {
  workspace: Workspace;
  tab: Tab;
  lesson: Lesson | null;
  question: Question | null;
  practiceLesson: Lesson | null;
  snapshot: Draft | null;
  error: string;
  notice: string;
  method: string;
  detail: Preferences['detail'];
  hintMode: boolean;
  hintCount: number;
  answerRevealed: boolean;
  practiceCounted: boolean;
  practiceFeedback: string[];
  practiceAnswers: Values;
  scenarioName: string;
  stale: boolean;
}

export function createAppState(workspace: Workspace, notice = ''): AppState {
  return {
    workspace,
    tab: 'Dashboard',
    lesson: null,
    question: null,
    practiceLesson: null,
    snapshot: null,
    error: '',
    notice,
    method: workspace.preferences.method,
    detail: workspace.preferences.detail,
    hintMode: false,
    hintCount: 0,
    answerRevealed: false,
    practiceCounted: false,
    practiceFeedback: [],
    practiceAnswers: {},
    scenarioName: '',
    stale: false,
  };
}

export function resetResult(state: AppState, resetPreferences = false): void {
  Object.assign(state, {
    lesson: null,
    question: null,
    practiceLesson: null,
    snapshot: null,
    error: '',
    hintCount: 0,
    answerRevealed: false,
    practiceCounted: false,
    practiceFeedback: [],
    practiceAnswers: {},
    scenarioName: '',
    stale: false,
  });
  if (resetPreferences) {
    state.method = state.workspace.preferences.method;
    state.detail = state.workspace.preferences.detail;
    state.hintMode = false;
  }
}
