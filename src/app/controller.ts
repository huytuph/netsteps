import { checkAnswer, makeQuestion, type Topic } from '../calculators/practice';
import { renderShell } from '../components/shell';
import { esc, readRows, readValues } from '../components/ui';
import { questionLesson } from '../explanations/lessons';
import { calculate } from '../pages/calculate';
import { descriptions } from '../pages/forms';
import { createActions } from './actions';
import { DraftStore } from './drafts';
import { mergeHistory, mergeWorkspace } from './history';
import { createAppState, resetResult } from './state';
import { entry, load, persist, validateWorkspace, type Tab } from './storage';
import { createViews } from './views';
export function startApp(root: HTMLDivElement) {
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
    bind();
    updateOffline();
  }
  function displayResult() {
    const el = document.querySelector('#result');
    if (el) {
      el.innerHTML = state.tab === 'Practice' ? practiceOutput() : resultOutput();
      el.querySelectorAll<HTMLInputElement>('#practice-answer input').forEach(
        (input) => (input.value = state.practiceAnswers[input.name] || ''),
      );
      bindResult();
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
  function bind() {
    document.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        nav(el.dataset.tab as Tab);
      }),
    );
    document.querySelector<HTMLFormElement>('#calculator')?.addEventListener('submit', (e) => {
      e.preventDefault();
      state.tab === 'Practice' ? generate() : run();
    });
    document.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) =>
      el.addEventListener('change', () => {
        capture();
        if (el.getAttribute('name') === 'mode')
          drafts.switchMode(state.tab, (el as HTMLSelectElement).value);
        resetResult(state);
        render();
      }),
    );
    document.querySelector('#calculator')?.addEventListener('input', () => {
      state.stale = !!state.lesson;
      root.querySelector('#stale')?.classList.remove('hidden');
    });
    document.querySelector<HTMLFormElement>('#preferences')?.addEventListener('change', () => {
      const f = document.querySelector<HTMLFormElement>('#preferences')!;
      const v = readValues(f);
      state.workspace.preferences = {
        theme: v.theme as typeof state.workspace.preferences.theme,
        detail: v.detail as typeof state.detail,
        method: v.method,
        history: v.history === 'on',
      };
      saveStorage();
      theme();
    });
    document
      .querySelector<HTMLInputElement>('#import-file')
      ?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw new Error('Backup must be smaller than 5 MiB.');
          const imported = validateWorkspace(JSON.parse(await file.text()));
          state.workspace = mergeWorkspace(state.workspace, imported);
          saveStorage();
          state.notice = `Imported ${imported.saved.length} saved scenarios.`;
          render();
        } catch (err) {
          notify((err as Error).message);
        }
      });
    bindActions(root);
    bindResult();
  }
  function bindResult() {
    const container = document.querySelector<HTMLElement>('#result');
    if (!container) return;
    container.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'scenario-name') state.scenarioName = input.value;
      if (input.closest('#practice-answer')) state.practiceAnswers[input.name] = input.value;
    });
    container
      .querySelector<HTMLSelectElement>('[name="explanation-method"]')
      ?.addEventListener('change', (e) => {
        state.method = (e.target as HTMLSelectElement).value;
        displayResult();
      });
    container
      .querySelector<HTMLSelectElement>('[name="detail-level"]')
      ?.addEventListener('change', (e) => {
        state.detail = (e.target as HTMLSelectElement).value as typeof state.detail;
        displayResult();
      });
    container
      .querySelector<HTMLInputElement>('[name="hint-mode"]')
      ?.addEventListener('change', (e) => {
        state.hintMode = (e.target as HTMLInputElement).checked;
        state.hintCount = 0;
        state.answerRevealed = false;
        displayResult();
      });
    container
      .querySelector<HTMLFormElement>('#practice-answer')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!state.question) return;
        const values = readValues(e.target as HTMLFormElement);
        const matches = state.question.answers.map((a, i) =>
          checkAnswer(values[`answer-${i}`] || '', a.value, state.question!.topic),
        );
        state.practiceFeedback = state.question.answers.map(
          (a, i) =>
            `${matches[i] ? '✓' : '✗'} ${a.label}: ${matches[i] ? 'Correct' : 'Try again, or use a hint.'}`,
        );
        if (!state.practiceCounted) {
          state.workspace.score.attempted++;
          if (matches.every(Boolean)) state.workspace.score.correct++;
          state.practiceCounted = true;
          saveStorage();
        }
        container.querySelector('.feedback')!.innerHTML = state.practiceFeedback
          .map((f) => `<p>${esc(f)}</p>`)
          .join('');
      });
    bindActions(container);
  }
  function bindActions(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', () => {
        void act(el).catch((e) => notify((e as Error).message));
      });
    });
  }
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
    themeQuery.removeEventListener('change', theme);
    root.innerHTML = '';
  };
}
