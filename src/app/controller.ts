import { checkAnswer, makeQuestion, type Topic } from '../calculators/practice';
import { renderShell } from '../components/shell';
import { esc, readRows, readValues } from '../components/ui';
import { questionLesson } from '../explanations/lessons';
import { resolveMethod } from '../explanations/methods';
import { calculate } from '../pages/calculate';
import { descriptions } from '../pages/forms';
import { createActions } from './actions';
import { DraftStore } from './drafts';
import { mergeHistory, mergeWorkspace } from './history';
import { createAppState, resetResult } from './state';
import { entry, load, persist, validateWorkspace, type Tab } from './storage';
import { createViews } from './views';
export function startApp(root: HTMLDivElement) {
  let disposed = false;
  const loaded = load();
  const state = createAppState(loaded.workspace, loaded.error);
  const drafts = new DraftStore();
  const { toolbar, dashboard, settings, workspacePage, resultOutput, practiceOutput, outputText } =
    createViews(state, data);
  const act = createActions({
    state,
    drafts,
    data,
    capture,
    render,
    displayResult,
    notify,
    saveStorage,
    nav,
    run,
    outputText,
  });
  function saveStorage() {
    try {
      persist(state.workspace);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function notify(message: string) {
    state.notice = message;
    const el = document.querySelector('#notice');
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
  }
  function theme() {
    const dark =
      state.workspace.preferences.theme === 'dark' ||
      (state.workspace.preferences.theme === 'system' &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const switcher = document.querySelector('[data-action="theme"]');
    if (switcher) {
      switcher.textContent =
        state.workspace.preferences.theme === 'system'
          ? '◐ System'
          : state.workspace.preferences.theme === 'dark'
            ? '☾ Dark'
            : '☀ Light';
    }
  }
  const themeQuery = matchMedia('(prefers-color-scheme: dark)');
  themeQuery.addEventListener('change', theme);
  theme();
  function capture() {
    const form = root.querySelector<HTMLFormElement>('#calculator');
    if (form)
      drafts.capture(
        state.tab,
        readValues(form),
        form.querySelector('.row-list') ? readRows(form) : undefined,
      );
  }
  function data() {
    return drafts.get(state.tab);
  }
  function nav(next: Tab) {
    capture();
    state.tab = next;
    resetResult(state, true);
    render();
    window.scrollTo({ top: 0 });
  }
  function render() {
    prepareResult();
    theme();
    root.innerHTML = renderShell({
      tab: state.tab,
      theme: state.workspace.preferences.theme,
      notice: state.notice,
      description: descriptions[state.tab],
      tools: toolbar(),
      body:
        state.tab === 'Dashboard'
          ? dashboard()
          : state.tab === 'Settings'
            ? settings()
            : workspacePage(),
    });
    updateOffline();
  }
  function prepareResult() {
    const lesson = state.tab === 'Practice' ? state.practiceLesson : state.lesson;
    if (lesson) state.method = resolveMethod(lesson, state.method);
  }
  function displayResult() {
    prepareResult();
    const el = root.querySelector('#result');
    if (el) {
      el.innerHTML = state.tab === 'Practice' ? practiceOutput() : resultOutput();
      el.querySelectorAll<HTMLInputElement>('#practice-answer input').forEach(
        (input) => (input.value = state.practiceAnswers[input.name] || ''),
      );
    }
  }
  function run(record = true) {
    capture();
    resetResult(state);
    try {
      const d = data();
      state.lesson = calculate(state.tab, d.values, d.rows);
      state.snapshot = { values: { ...d.values }, rows: d.rows.map((r) => ({ ...r })) };
      state.hintCount = 0;
      state.answerRevealed = false;
      if (record && state.workspace.preferences.history) {
        state.workspace.history = mergeHistory(state.workspace.history, [
          entry(state.tab, d.values, d.rows, state.lesson.title, state.lesson.summary),
        ]);
        saveStorage();
      }
    } catch (e) {
      state.error = (e as Error).message;
      state.lesson = null;
      state.snapshot = null;
    }
    displayResult();
  }
  function generate() {
    capture();
    resetResult(state);
    try {
      const v = data().values;
      const custom =
        v.difficulty === 'Custom'
          ? {
              ip: v.customIp,
              prefix: v.customPrefix,
              hosts: Number(v.customHosts),
              nextHop: v.customNextHop,
              exitInterface: v.customExit || '',
              requirements: v.customRows
                .split('\n')
                .filter((x) => x.trim())
                .map((line) => {
                  const [name, hosts] = line.split(',');
                  return { name, hosts: Number(hosts), mode: 'lan' as const };
                }),
            }
          : undefined;
      state.question = makeQuestion(v.topic as Topic, v.difficulty, custom);
      state.practiceCounted = false;
      state.practiceFeedback = [];
      state.hintCount = 0;
      state.answerRevealed = false;
      state.practiceLesson = questionLesson(state.question);
    } catch (e) {
      state.question = null;
      state.error = (e as Error).message;
    }
    displayResult();
  }
  function onClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLElement>('[data-tab]');
    if (link && root.contains(link)) {
      event.preventDefault();
      nav(link.dataset.tab as Tab);
      return;
    }
    const button = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (button && root.contains(button) && !button.disabled)
      void act(button).catch((error) => notify((error as Error).message));
  }
  function onSubmit(event: SubmitEvent) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'calculator') {
      event.preventDefault();
      state.tab === 'Practice' ? generate() : run();
    } else if (form.id === 'practice-answer') {
      event.preventDefault();
      if (!state.question) return;
      const values = readValues(form);
      const matches = state.question.answers.map((answer, i) =>
        checkAnswer(values[`answer-${i}`] || '', answer.value, state.question!.topic),
      );
      state.practiceFeedback = state.question.answers.map(
        (answer, i) =>
          `${matches[i] ? '✓' : '✗'} ${answer.label}: ${matches[i] ? 'Correct' : 'Try again, or use a hint.'}`,
      );
      if (!state.practiceCounted) {
        state.workspace.score.attempted++;
        if (matches.every(Boolean)) state.workspace.score.correct++;
        state.practiceCounted = true;
        saveStorage();
      }
      root.querySelector('.feedback')!.innerHTML = state.practiceFeedback
        .map((text) => `<p>${esc(text)}</p>`)
        .join('');
    }
  }
  function onInput(event: Event) {
    const input = event.target;
    if (!(
      input instanceof HTMLInputElement ||
      input instanceof HTMLTextAreaElement ||
      input instanceof HTMLSelectElement
    ))
      return;
    if (input.closest('#calculator')) {
      state.stale = !!state.lesson;
      root.querySelector('#stale')?.classList.remove('hidden');
    }
    if (input.name === 'scenario-name') state.scenarioName = input.value;
    if (input.closest('#practice-answer')) state.practiceAnswers[input.name] = input.value;
  }
  function onChange(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    if (input.matches('[data-mode]')) {
      capture();
      if (input.name === 'mode') drafts.switchMode(state.tab, input.value);
      resetResult(state);
      render();
    } else if (input.closest('#preferences')) {
      const values = readValues(root.querySelector<HTMLFormElement>('#preferences')!);
      state.workspace.preferences = {
        theme: values.theme as typeof state.workspace.preferences.theme,
        detail: values.detail as typeof state.detail,
        method: values.method,
        history: values.history === 'on',
      };
      saveStorage();
      theme();
    } else if (input.id === 'import-file' && input instanceof HTMLInputElement) {
      void importBackup(input);
    } else if (input.name === 'explanation-method') {
      state.method = input.value;
      displayResult();
    } else if (input.name === 'detail-level') {
      state.detail = input.value as typeof state.detail;
      displayResult();
    } else if (input.name === 'hint-mode' && input instanceof HTMLInputElement) {
      state.hintMode = input.checked;
      state.hintCount = 0;
      state.answerRevealed = false;
      displayResult();
    }
  }
  async function importBackup(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    capture();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Backup must be smaller than 5 MiB.');
      const imported = validateWorkspace(JSON.parse(await file.text()));
      if (disposed) return;
      // Capture again so edits or navigation during file reading are preserved.
      capture();
      state.workspace = mergeWorkspace(state.workspace, imported);
      saveStorage();
      state.notice = `Imported ${imported.saved.length} saved scenarios.`;
      render();
    } catch (error) {
      if (!disposed) notify((error as Error).message);
    } finally {
      input.value = '';
    }
  }
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  let offlineMessage =
    location.protocol === 'file:' ? 'Self-contained offline file' : 'Local calculations ready';
  function updateOffline() {
    const el = document.querySelector('#offline-status');
    if (el) el.textContent = offlineMessage;
  }
  render();
  if ('serviceWorker' in navigator && !import.meta.env.DEV && location.protocol !== 'file:')
    navigator.serviceWorker
      .register('./sw.js')
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        offlineMessage = 'Offline app cache ready';
        updateOffline();
        if (reg.waiting)
          notify('An updated app is ready. Close all toolkit tabs and reopen to use it.');
      })
      .catch(() => {
        offlineMessage = 'Local calculations ready · cache unavailable';
        updateOffline();
      });
  return () => {
    disposed = true;
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
    themeQuery.removeEventListener('change', theme);
    root.innerHTML = '';
  };
}
