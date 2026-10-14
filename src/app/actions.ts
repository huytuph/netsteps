import { planVlsm } from '../calculators/vlsm';
import { copy, download } from '../components/ui';
import { blankRow } from '../pages/forms';
import { requiredNumber } from '../pages/inputs';
import type { DraftStore } from './drafts';
import type { AppState, Draft } from './state';
import { resetResult } from './state';
import type { Tab } from './storage';
import { defaults, entry } from './storage';
interface ActionContext {
  state: AppState;
  drafts: DraftStore;
  data(): Draft;
  capture(): void;
  render(): void;
  displayResult(): void;
  notify(message: string): void;
  saveStorage(): void;
  nav(tab: Tab): void;
  run(record?: boolean): void;
  outputText(kind?: string): string;
}
export function createActions(context: ActionContext) {
  const {
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
  } = context;
  async function act(el: HTMLButtonElement) {
    const action = el.dataset.action!,
      d = data();
    if (action === 'theme') {
      state.workspace.preferences.theme =
        state.workspace.preferences.theme === 'system'
          ? 'light'
          : state.workspace.preferences.theme === 'light'
            ? 'dark'
            : 'system';
      saveStorage();
      capture();
      render();
    } else if (action === 'import')
      document.querySelector<HTMLInputElement>('#import-file')?.click();
    else if (action === 'export-all')
      download('netsteps-backup.json', JSON.stringify(state.workspace, null, 2));
    else if (action === 'reset-form') {
      drafts.reset(state.tab);
      resetResult(state);
      render();
    } else if (['add-row', 'remove-row', 'up', 'down'].includes(action)) {
      capture();
      const i = Number(el.dataset.index);
      if (action === 'add-row') {
        if (d.rows.length >= 256) throw new Error('Maximum 256 rows.');
        d.rows.push(blankRow(state.tab, drafts.mode(state.tab)));
      } else if (action === 'remove-row') d.rows.splice(i, 1);
      else {
        const j = action === 'up' ? i - 1 : i + 1;
        [d.rows[i], d.rows[j]] = [d.rows[j], d.rows[i]];
      }
      resetResult(state);
      render();
    } else if (action === 'allocate-vlans') {
      capture();
      const p = planVlsm(
        d.values.base,
        d.rows.map((r) => ({
          name: r.id,
          hosts: requiredNumber(r.hosts, 'Required VLAN hosts') + 1,
          mode: 'lan',
        })),
        true,
        0,
      );
      for (const a of p.allocations) {
        const r = d.rows.find((r) => r.id === a.name)!;
        r.network = `${a.subnet.network}/${a.subnet.prefix}`;
        r.gateway = a.subnet.first;
      }
      resetResult(state);
      render();
    } else if (action === 'default-route') {
      capture();
      d.values.destination = state.tab === 'IPv6' ? '::/0' : '0.0.0.0/0';
      resetResult(state);
      render();
    } else if (action === 'next-step' || action === 'practice-hint') {
      state.hintCount++;
      displayResult();
    } else if (action === 'show-working') {
      state.hintCount = 10000;
      displayResult();
    } else if (action === 'reveal') {
      state.answerRevealed = true;
      displayResult();
    } else if (action === 'print') {
      capture();
      if (
        state.snapshot &&
        (JSON.stringify(d.values) !== JSON.stringify(state.snapshot.values) ||
          JSON.stringify(d.rows) !== JSON.stringify(state.snapshot.rows))
      )
        throw new Error('Inputs have changed. Calculate again before printing.');
      window.print();
    } else if (action.startsWith('copy-')) {
      const kind =
        action === 'copy-answer'
          ? 'answer'
          : action === 'copy-working'
            ? 'working'
            : action === 'copy-command'
              ? 'commands'
              : action === 'copy-table'
                ? 'table'
                : 'all';
      await copy(outputText(kind));
      notify('Copied to clipboard.');
    } else if (action === 'export-result')
      download('netsteps-notes.md', outputText(), 'text/markdown');
    else if (action === 'export-csv' && state.lesson?.rows && state.lesson.columns) {
      download(
        'netsteps-allocation.csv',
        [state.lesson.columns, ...state.lesson.rows]
          .map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(','))
          .join('\r\n'),
        'text/csv',
      );
    } else if (action === 'save-scenario' || action === 'export-scenario') {
      if (!state.lesson || !state.snapshot) return;
      const name = state.scenarioName.trim() || state.lesson.title;
      const e = entry(
        state.tab,
        state.snapshot.values,
        state.snapshot.rows,
        name,
        state.lesson.summary,
      );
      if (action === 'save-scenario') {
        state.workspace.saved.push(e);
        saveStorage();
        notify(`Saved “${name}” in this browser.`);
      } else {
        const out = defaults();
        out.saved = [e];
        out.preferences = { ...state.workspace.preferences };
        download('netsteps-scenario.json', JSON.stringify(out, null, 2));
      }
    } else if (action === 'open-entry') {
      const e = (
        el.dataset.kind === 'saved' ? state.workspace.saved : state.workspace.history
      ).find((e) => e.id === el.dataset.id);
      if (e) {
        nav(e.tab);
        drafts.restore(e);
        render();
        run(false);
      }
    } else if (action === 'delete-entry') {
      state.workspace.saved = state.workspace.saved.filter((e) => e.id !== el.dataset.id);
      saveStorage();
      render();
    } else if (action === 'clear-history') {
      state.workspace.history = [];
      saveStorage();
      capture();
      render();
    } else if (action === 'reset-data') {
      if (
        window.confirm(
          'Delete all saved scenarios, preferences, history and practice scores from this browser?',
        )
      ) {
        state.workspace = defaults();
        drafts.clear();
        state.tab = 'Dashboard';
        resetResult(state, true);
        saveStorage();
        state.notice = 'Local workspace reset.';
        render();
      }
    }
  }
  return act;
}
