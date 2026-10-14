import './styles/catalogue.css';
import './styles/print.css';
import { renderShell } from './components/shell';
import {
  defaults,
  entry,
  Entry,
  load,
  persist,
  Tab,
  tabs,
  validateWorkspace,
  Values,
} from './app/storage';
import {
  button,
  checkbox,
  copy,
  download,
  esc,
  field,
  readRows,
  readValues,
  select,
  table,
} from './components/ui';
import { baseValues, blankRow, descriptions, formFields, initialRows } from './pages/forms';
import { calculate, requiredNumber } from './pages/calculate';
import { Lesson, methodLabels, questionLesson, methodWhy } from './explanations/lessons';
import { checkAnswer, makeQuestion, Question, Topic } from './calculators/practice';
import { planVlsm } from './calculators/vlsm';

const root = document.querySelector<HTMLDivElement>('#app')!;
const loaded = load();
let workspace = loaded.workspace;
let tab: Tab = 'Dashboard',
  lesson: Lesson | null = null,
  question: Question | null = null,
  practiceLesson: Lesson | null = null,
  error = '',
  notice = loaded.error || '';
let method = workspace.preferences.method,
  detail = workspace.preferences.detail,
  hintMode = false,
  hintCount = 0,
  answerRevealed = false,
  practiceCounted = false,
  practiceFeedback: string[] = [];
let snapshot: { values: Values; rows: Values[] } | null = null;
let practiceAnswers: Values = {};
const drafts: Partial<Record<Tab, { values: Values; rows: Values[] }>> = {};
const icons = ['◈', '01', '▦', '⑥', '⇆', '↗', '◇', '⇄', '⇌', '↔', '⋈', '✎', '⚙'];
function saveStorage() {
  try {
    persist(workspace);
  } catch (e) {
    notify((e as Error).message);
  }
}
function notify(message: string) {
  notice = message;
  const el = document.querySelector('#notice');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}
function theme() {
  const dark =
    workspace.preferences.theme === 'dark' ||
    (workspace.preferences.theme === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const switcher = document.querySelector('[data-action="theme"]');
  if (switcher) {
    switcher.textContent =
      workspace.preferences.theme === 'system'
        ? '◐ System'
        : workspace.preferences.theme === 'dark'
          ? '☾ Dark'
          : '☀ Light';
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
theme();
function capture() {
  const form = document.querySelector<HTMLFormElement>('#calculator');
  if (form) {
    const d = data();
    d.values = { ...d.values, ...readValues(form) };
    if (form.querySelector('.row-list'))
      d.rows = readRows(form).map((r, i) => ({ ...d.rows[i], ...r }));
  }
}
function data() {
  return (drafts[tab] ||= { values: { ...baseValues[tab] }, rows: initialRows(tab) });
}
function nav(next: Tab) {
  capture();
  tab = next;
  lesson = null;
  question = null;
  practiceLesson = null;
  snapshot = null;
  error = '';
  hintCount = 0;
  answerRevealed = false;
  method = workspace.preferences.method;
  detail = workspace.preferences.detail;
  render();
  window.scrollTo({ top: 0 });
}
function toolbar() {
  return `<div class="utility-actions">${button('export-all', 'Export backup')}${button('import', 'Import')}<input id="import-file" type="file" accept=".json,application/json" hidden></div>`;
}
function render() {
  const answers = document.querySelector<HTMLFormElement>('#practice-answer');
  if (answers) practiceAnswers = readValues(answers);
  theme();
  root.innerHTML = renderShell({
    tab,
    theme: workspace.preferences.theme,
    notice,
    description: descriptions[tab],
    tools: toolbar(),
    body: tab === 'Dashboard' ? dashboard() : tab === 'Settings' ? settings() : workspacePage(),
  });
  bind();
  updateOffline();
}
function dashboard() {
  const cards = tabs
    .slice(1, -1)
    .map(
      (t, i) =>
        `<button class="tool-card" data-tab="${esc(t)}"><span class="card-icon">${icons[i + 1]}</span><span class="card-number">${String(i + 1).padStart(2, '0')}</span><h3>${esc(t)}</h3><p>${esc(descriptions[t])}</p><span class="card-link">Open workspace <span>↗</span></span></button>`,
    )
    .join('');
  return `<section class="hero"><div class="hero-copy"><span class="hero-tag">YOUR PERSONAL NETWORK LAB</span><h2>From inputs<br>to understanding.</h2><p>Calculate, follow the manual steps, and practice.<br>Everything happens right here in your browser.</p><div class="hero-actions"><button data-tab="Subnetting" class="primary">Start subnetting <span>→</span></button><button data-tab="Practice" class="hero-secondary">Try a practice question</button></div></div><div class="network-visual" aria-hidden="true"><div class="visual-caption">172.16.1.0 /24</div><div class="net-root">NETWORK <b>256 addresses</b></div><div class="net-branches"><div>/25<b>128</b></div><div>/26<b>64</b></div><div>/27<b>32</b></div><div>/27<b>32</b></div></div><div class="visual-bottom">ONE NETWORK. MANY POSSIBILITIES.</div></div></section><div class="stats"><div><span>Study tools</span><b>${tabs.length - 2} <small>workspaces</small></b></div><div><span>Saved scenarios</span><b>${workspace.saved.length} <small>on this device</small></b></div><div><span>Practice progress</span><b>${workspace.score.correct}/${workspace.score.attempted} <small>correct</small></b></div><div><span>Connection required</span><b>None <small>for calculations</small></b></div></div><div class="section-title"><h2>Choose your next topic</h2><span>INPUT → WORKING → RESULT</span></div><div class="tool-grid">${cards}</div><div class="dashboard-lists"><section class="panel"><div class="section-title"><h2>Saved scenarios</h2><span>${workspace.saved.length}</span></div>${entries(workspace.saved, 'saved')}</section><section class="panel"><div class="section-title"><h2>Recent calculations</h2>${button('clear-history', 'Clear history')}</div>${entries(workspace.history.slice(0, 10), 'history')}</section></div>`;
}
function entries(list: Entry[], kind: string) {
  return list.length
    ? `<ul class="entries">${list.map((e) => `<li><button class="entry-open" data-action="open-entry" data-kind="${kind}" data-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>${esc(e.tab)} · ${esc(e.summary)}</span><small>${esc(new Date(e.date).toLocaleString())}</small></button>${kind === 'saved' ? button('delete-entry', '×', `aria-label="Delete ${esc(e.name)}" data-id="${esc(e.id)}"`) : ''}</li>`).join('')}</ul>`
    : `<div class="empty-list"><span>◈</span><p>${kind === 'saved' ? 'Keep useful scenarios here. Calculate, give your scenario a name, and save it.' : 'Your calculations will appear here when history is enabled.'}</p></div>`;
}
function settings() {
  const p = workspace.preferences;
  return `<div class="settings-grid"><section class="panel"><h2>Display & explanations</h2><form id="preferences">${select(
    'theme',
    'Theme',
    p.theme,
    [
      ['system', 'System'],
      ['light', 'Light'],
      ['dark', 'Dark'],
    ],
  )}${select('method', 'Default explanation method', p.method, [
    ['recommended', 'Recommended / Easiest'],
    ['exam', 'Short Exam Method'],
  ])}${select('detail', 'Default detail level', p.detail, [
    ['full', 'Full Working'],
    ['standard', 'Standard'],
    ['exam', 'Short Exam Form'],
    ['final', 'Final Answer Only'],
  ])}${checkbox('history', 'Keep local calculation history', p.history)}<p class="muted">Changes are saved automatically. Method and detail can be adjusted independently in each result.</p></form></section><section class="panel"><h2>Your local data</h2><p>Preferences, scenarios, history and practice scores are kept in this browser’s localStorage. Export a backup to move them to another browser or device.</p><div class="stack-actions">${button('export-all', 'Download JSON backup')}${button('import', 'Import JSON backup')}${button('clear-history', 'Clear history')}${button('reset-data', 'Reset all local data', 'class="danger"')}</div><div class="note">Imports merge scenarios and history, and apply the imported preferences. The existing browser data stays until you choose to reset it.</div><h3>Offline use</h3><p>Open <code>offline.html</code> from the downloaded build, or serve <code>dist/</code> locally. On localhost, the app caches its files after the first successful visit.</p><p>No backend, external APIs, remote fonts, analytics or account. Clearing browser data removes local saves.</p></section></div>`;
}
function workspacePage() {
  const d = data();
  return `<div class="workspace-grid"><section class="panel input-panel"><div class="panel-heading"><span class="step-badge">01</span><div><h2>Your inputs</h2><p>${tab === 'Practice' ? 'Choose a topic and difficulty.' : 'Enter actual network values.'}</p></div></div><form id="calculator">${formFields(tab, d.values, d.rows)}<div class="form-actions"><button type="submit" class="primary">${tab === 'Practice' ? 'Generate question' : 'Calculate & explain'} <span>→</span></button>${button('reset-form', 'Reset inputs')}</div></form><div class="privacy-note">◇ Calculated on your device.</div></section><section id="result" class="result-panel" aria-live="polite">${tab === 'Practice' ? practiceOutput() : resultOutput()}</section></div>`;
}
function methodControls(l: Lesson) {
  if (!l.methods[method]) method = 'recommended';
  return `<div class="explanation-controls">${select(
    'explanation-method',
    'Explanation method',
    method,
    Object.keys(l.methods).map((m) => [m, methodLabels[m] || m]),
  )}${select('detail-level', 'Detail level', detail, [
    ['full', 'Full Working'],
    ['standard', 'Standard'],
    ['exam', 'Short Exam Form'],
    ['final', 'Final Answer Only'],
  ])}</div>`;
}
function working(l: Lesson, practice = false) {
  if (!l.methods[method]) method = 'recommended';
  let steps = l.methods[method] || l.methods.recommended;
  if (detail === 'standard')
    steps = steps.length > 4 ? [steps[0], steps[1], steps.at(-2)!, steps.at(-1)!] : steps;
  if (detail === 'exam') steps = steps.length > 2 ? [steps[0], steps.at(-1)!] : steps;
  const hidden = practice || hintMode ? steps.slice(0, hintCount) : steps;
  return `${methodControls(l)}${detail !== 'final' ? `<div class="why"><strong>Why this method?</strong><p>${esc(methodWhy(l, method))}</p></div>${!practice ? checkbox('hint-mode', 'Progressive hint mode', hintMode) : ''}${practice || hintMode ? `<div class="hint-actions">${button('next-step', 'Show next step')}${button('show-working', 'Show full working')}${button('reveal', 'Reveal answer')}</div>` : ''}<ol class="steps">${hidden.map((s) => `<li><strong>${esc(s.title)}</strong><pre>${esc(s.text)}</pre></li>`).join('')}</ol>${hidden.length === 0 ? '<p class="muted">Use Show next step to begin.</p>' : ''}` : ''}`;
}
function resultOutput() {
  if (error)
    return `<div class="panel error" role="alert"><h2>Check your inputs</h2><p>${esc(error)}</p></div>`;
  if (!lesson)
    return `<div class="panel waiting"><span class="waiting-icon">⇆</span><h2>Make the working visible.</h2><p>Enter your values and calculate to see the answer, manual steps, and alternative methods.</p><div class="flow"><span>INPUT</span><b>→</b><span>WORKING</span><b>→</b><span>RESULT</span></div></div>`;
  const l = lesson;
  const show = detail === 'final' || !hintMode || answerRevealed;
  return `<div id="stale" class="notice hidden">Inputs changed. Calculate again to update this result.</div><section class="panel working-panel"><div class="panel-heading"><span class="step-badge">02</span><div><h2>Manual working</h2><p>${esc(l.title)}</p></div></div>${working(l)}</section>${show ? `<section class="panel final-panel"><div class="panel-heading"><span class="step-badge">03</span><div><h2>Final result</h2><p>${esc(l.summary)}</p></div></div>${l.warnings?.length ? `<div class="warnings">${l.warnings.map((w) => `<p>⚠ ${esc(w)}</p>`).join('')}</div>` : ''}<dl class="metrics">${l.metrics.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${l.rows && l.columns ? table(l.columns, l.rows) : ''}${l.commands ? `<h3>Conceptual Cisco configuration</h3><pre class="command">${esc(l.commands)}</pre><p class="muted">Study configuration: adapt interfaces and syntax to your device and lab topology.</p>` : ''}<div class="output-actions">${button('copy-answer', 'Copy answer')}${button('copy-working', 'Copy working')}${l.commands ? button('copy-command', 'Copy commands') : ''}${l.rows ? button('copy-table', 'Copy table') + button('export-csv', 'Export CSV') : ''}${button('copy-markdown', 'Copy Markdown')}${button('export-result', 'Export notes')}${button('print', 'Print')}</div><div class="save-scenario">${field('scenario-name', 'Scenario name', '', 'text', 'For example: Campus VLAN Design')}${button('save-scenario', 'Save scenario', 'class="primary"')}${button('export-scenario', 'Export scenario')}</div></section>` : '<div class="panel note">Answer hidden. Work through the steps, then reveal when ready.</div>'}`;
}
function practiceOutput() {
  if (error)
    return `<div class="panel error" role="alert"><h2>Check your question settings</h2><p>${esc(error)}</p></div>`;
  if (!question)
    return `<div class="panel waiting"><span class="waiting-icon">✎</span><h2>Learn by doing.</h2><p>Generate a question, try your answer, and uncover the working one step at a time.</p></div>`;
  return `<section class="panel"><div class="eyebrow">PRACTICE · ${esc(question.topic)}</div><h2>${esc(question.prompt)}</h2><form id="practice-answer">${question.answers.map((a, i) => field(`answer-${i}`, a.label, practiceAnswers[`answer-${i}`] || '')).join('')}<button class="primary" type="submit">Check my answer</button></form><div class="feedback" role="status">${practiceFeedback.map((f) => `<p>${esc(f)}</p>`).join('')}</div><div class="hint-actions">${button('practice-hint', 'Show next hint')}${button('reveal', 'Reveal answer')}</div><ul class="practice-hints">${question.hints
    .slice(0, hintCount)
    .map((h) => `<li>${esc(h)}</li>`)
    .join(
      '',
    )}</ul>${answerRevealed ? `<div class="answer-note"><h3>Expected answers</h3>${question.answers.map((a) => `<p><strong>${esc(a.label)}:</strong> <code>${esc(a.value)}</code></p>`).join('')}</div>` : ''}</section><section class="panel"><h2>Manual working</h2>${practiceLesson ? working(practiceLesson, true) : ''}</section>`;
}
function outputText(kind = 'all') {
  if (!lesson) return '';
  const l = lesson;
  const metrics = l.metrics.map(([k, v]) => `${k}: ${v}`).join('\n');
  const steps = (l.methods[method] || l.methods.recommended)
    .map((s, i) => `${i + 1}. ${s.title}\n${s.text}`)
    .join('\n\n');
  const md =
    l.columns && l.rows
      ? [l.columns, l.columns.map(() => '---'), ...l.rows]
          .map(
            (r) =>
              '| ' + r.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |',
          )
          .join('\n')
      : '';
  return kind === 'answer'
    ? metrics
    : kind === 'working'
      ? steps
      : kind === 'commands'
        ? l.commands || ''
        : kind === 'table'
          ? md
          : `# ${l.title}\n\n## Inputs\n${Object.entries(snapshot?.values || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}\n${
              snapshot?.rows
                .map((r) =>
                  Object.entries(r)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', '),
                )
                .join('\n') || ''
            }\n\n## Manual working (${methodLabels[method]})\n${steps}\n\n## Final result\n${metrics}\n\n${md}\n\n${l.commands ? '```text\n' + l.commands + '\n```' : ''}\n${l.warnings?.join('\n') || ''}`;
}
function displayResult(preserveAnswers = true) {
  const el = document.querySelector('#result');
  if (el) {
    const answers = el.querySelector<HTMLFormElement>('#practice-answer');
    if (answers && preserveAnswers) practiceAnswers = readValues(answers);
    el.innerHTML = tab === 'Practice' ? practiceOutput() : resultOutput();
    el.querySelectorAll<HTMLInputElement>('#practice-answer input').forEach(
      (input) => (input.value = practiceAnswers[input.name] || ''),
    );
    bindResult();
  }
}
function run(record = true) {
  capture();
  error = '';
  try {
    const d = data();
    lesson = calculate(tab, d.values, d.rows);
    snapshot = { values: { ...d.values }, rows: d.rows.map((r) => ({ ...r })) };
    hintCount = 0;
    answerRevealed = false;
    if (record && workspace.preferences.history) {
      workspace.history.unshift(entry(tab, d.values, d.rows, lesson.title, lesson.summary));
      workspace.history = workspace.history.slice(0, 100);
      saveStorage();
    }
  } catch (e) {
    error = (e as Error).message;
    lesson = null;
    snapshot = null;
  }
  displayResult();
}
function generate() {
  capture();
  practiceAnswers = {};
  document.querySelector<HTMLFormElement>('#practice-answer')?.reset();
  error = '';
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
    question = makeQuestion(v.topic as Topic, v.difficulty, custom);
    practiceCounted = false;
    practiceFeedback = [];
    hintCount = 0;
    answerRevealed = false;
    practiceLesson = questionLesson(question);
  } catch (e) {
    question = null;
    error = (e as Error).message;
  }
  displayResult(false);
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
    tab === 'Practice' ? generate() : run();
  });
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) =>
    el.addEventListener('change', () => {
      capture();
      lesson = null;
      question = null;
      error = '';
      render();
    }),
  );
  document
    .querySelector('#calculator')
    ?.addEventListener('input', () => document.querySelector('#stale')?.classList.remove('hidden'));
  document.querySelector<HTMLFormElement>('#preferences')?.addEventListener('change', () => {
    const f = document.querySelector<HTMLFormElement>('#preferences')!;
    const v = readValues(f);
    workspace.preferences = {
      theme: v.theme as typeof workspace.preferences.theme,
      detail: v.detail as typeof detail,
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
        const merge = (a: Entry[], b: Entry[]) => [
          ...new Map([...a, ...b].map((x) => [x.id, x])).values(),
        ];
        workspace = {
          ...workspace,
          preferences: imported.preferences,
          saved: merge(workspace.saved, imported.saved),
          history: merge(workspace.history, imported.history).slice(-100),
          score: {
            correct: Math.max(workspace.score.correct, imported.score.correct),
            attempted: Math.max(workspace.score.attempted, imported.score.attempted),
          },
        };
        saveStorage();
        notice = `Imported ${imported.saved.length} saved scenarios.`;
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
  container
    .querySelector<HTMLSelectElement>('[name="explanation-method"]')
    ?.addEventListener('change', (e) => {
      method = (e.target as HTMLSelectElement).value;
      displayResult();
    });
  container
    .querySelector<HTMLSelectElement>('[name="detail-level"]')
    ?.addEventListener('change', (e) => {
      detail = (e.target as HTMLSelectElement).value as typeof detail;
      displayResult();
    });
  container
    .querySelector<HTMLInputElement>('[name="hint-mode"]')
    ?.addEventListener('change', (e) => {
      hintMode = (e.target as HTMLInputElement).checked;
      hintCount = 0;
      answerRevealed = false;
      displayResult();
    });
  container.querySelector<HTMLFormElement>('#practice-answer')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!question) return;
    const values = readValues(e.target as HTMLFormElement);
    const matches = question.answers.map((a, i) =>
      checkAnswer(values[`answer-${i}`] || '', a.value, question!.topic),
    );
    practiceFeedback = question.answers.map(
      (a, i) =>
        `${matches[i] ? '✓' : '✗'} ${a.label}: ${matches[i] ? 'Correct' : 'Try again, or use a hint.'}`,
    );
    if (!practiceCounted) {
      workspace.score.attempted++;
      if (matches.every(Boolean)) workspace.score.correct++;
      practiceCounted = true;
      saveStorage();
    }
    container.querySelector('.feedback')!.innerHTML = practiceFeedback
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
async function act(el: HTMLButtonElement) {
  const action = el.dataset.action!,
    d = data();
  if (action === 'theme') {
    workspace.preferences.theme =
      workspace.preferences.theme === 'system'
        ? 'light'
        : workspace.preferences.theme === 'light'
          ? 'dark'
          : 'system';
    saveStorage();
    capture();
    render();
  } else if (action === 'import') document.querySelector<HTMLInputElement>('#import-file')?.click();
  else if (action === 'export-all')
    download('netsteps-backup.json', JSON.stringify(workspace, null, 2));
  else if (action === 'reset-form') {
    drafts[tab] = { values: { ...baseValues[tab] }, rows: initialRows(tab) };
    lesson = null;
    question = null;
    error = '';
    render();
  } else if (['add-row', 'remove-row', 'up', 'down'].includes(action)) {
    capture();
    const i = Number(el.dataset.index);
    if (action === 'add-row') {
      if (d.rows.length >= 256) throw new Error('Maximum 256 rows.');
      d.rows.push(blankRow(tab));
    } else if (action === 'remove-row') d.rows.splice(i, 1);
    else {
      const j = action === 'up' ? i - 1 : i + 1;
      [d.rows[i], d.rows[j]] = [d.rows[j], d.rows[i]];
    }
    lesson = null;
    error = '';
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
    lesson = null;
    render();
  } else if (action === 'default-route') {
    capture();
    d.values.destination = tab === 'IPv6' ? '::/0' : '0.0.0.0/0';
    lesson = null;
    render();
  } else if (action === 'next-step' || action === 'practice-hint') {
    hintCount++;
    displayResult();
  } else if (action === 'show-working') {
    hintCount = 10000;
    displayResult();
  } else if (action === 'reveal') {
    answerRevealed = true;
    displayResult();
  } else if (action === 'print') {
    capture();
    if (
      snapshot &&
      (JSON.stringify(d.values) !== JSON.stringify(snapshot.values) ||
        JSON.stringify(d.rows) !== JSON.stringify(snapshot.rows))
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
  else if (action === 'export-csv' && lesson?.rows && lesson.columns) {
    download(
      'netsteps-allocation.csv',
      [lesson.columns, ...lesson.rows]
        .map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(','))
        .join('\r\n'),
      'text/csv',
    );
  } else if (action === 'save-scenario' || action === 'export-scenario') {
    if (!lesson || !snapshot) return;
    const name =
      document.querySelector<HTMLInputElement>('[name="scenario-name"]')?.value.trim() ||
      lesson.title;
    const e = entry(tab, snapshot.values, snapshot.rows, name, lesson.summary);
    if (action === 'save-scenario') {
      workspace.saved.push(e);
      saveStorage();
      notify(`Saved “${name}” in this browser.`);
    } else {
      const out = defaults();
      out.saved = [e];
      out.preferences = { ...workspace.preferences };
      download('netsteps-scenario.json', JSON.stringify(out, null, 2));
    }
  } else if (action === 'open-entry') {
    const e = (el.dataset.kind === 'saved' ? workspace.saved : workspace.history).find(
      (e) => e.id === el.dataset.id,
    );
    if (e) {
      drafts[e.tab] = {
        values: { ...baseValues[e.tab], ...e.values },
        rows: e.rows.map((r) => ({ ...r })),
      };
      nav(e.tab);
      run(false);
    }
  } else if (action === 'delete-entry') {
    workspace.saved = workspace.saved.filter((e) => e.id !== el.dataset.id);
    saveStorage();
    render();
  } else if (action === 'clear-history') {
    workspace.history = [];
    saveStorage();
    capture();
    render();
  } else if (action === 'reset-data') {
    if (
      window.confirm(
        'Delete all saved scenarios, preferences, history and practice scores from this browser?',
      )
    ) {
      workspace = defaults();
      Object.keys(drafts).forEach((k) => delete drafts[k as Tab]);
      tab = 'Dashboard';
      lesson = null;
      question = null;
      snapshot = null;
      saveStorage();
      notice = 'Local workspace reset.';
      render();
    }
  }
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
