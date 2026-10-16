import { button, checkbox, esc, field, select, table } from '../components/ui';
import { renderStepText } from '../components/explanation';
import { methodLabels, methodOptions, methodWhy, resolveMethod } from '../explanations/methods';
import type { Lesson } from '../explanations/model';
import { formFields } from '../pages/forms';
import type { AppState, Draft } from './state';
import type { Entry } from './storage';
import { sections, sectionMetadata, toolFor, locationLabel } from './navigation';
export function createViews(state: Readonly<AppState>, data: () => Draft) {
  function toolbar() {
    return `<div class="utility-actions">${button('export-all', 'Export backup')}${button('import', 'Import')}<input id="import-file" type="file" accept=".json,application/json" hidden></div>`;
  }
  function dashboard() {
    const cards = sections
      .slice(1, -1)
      .map(
        (t, i) =>
          `<button class="tool-card" data-section="${esc(t)}"><span class="card-icon">${sectionMetadata[t].icon}</span><span class="card-number">${String(i + 1).padStart(2, '0')}</span><h3>${esc(t)}</h3><p>${esc(sectionMetadata[t].description)}</p><span class="card-link">Open workspace <span>↗</span></span></button>`,
      )
      .join('');
    return `<section class="hero"><div class="hero-copy"><span class="hero-tag">YOUR PERSONAL NETWORK LAB</span><h2>From inputs<br>to understanding.</h2><p>Calculate, follow the manual steps, and practice.<br>Everything happens right here in your browser.</p><div class="hero-actions"><button data-tab="Subnetting" class="primary">Start subnetting <span>→</span></button><button data-tab="Practice" class="hero-secondary">Try a practice question</button></div></div><div class="network-visual" aria-hidden="true"><div class="visual-caption">172.16.1.0 /24</div><div class="net-root">NETWORK <b>256 addresses</b></div><div class="net-branches"><div>/25<b>128</b></div><div>/26<b>64</b></div><div>/27<b>32</b></div><div>/27<b>32</b></div></div><div class="visual-bottom">ONE NETWORK. MANY POSSIBILITIES.</div></div></section><div class="stats"><div><span>Study areas</span><b>${sections.length - 2} <small>workspaces</small></b></div><div><span>Saved scenarios</span><b>${state.workspace.saved.length} <small>on this device</small></b></div><div><span>Practice progress</span><b>${state.workspace.score.correct}/${state.workspace.score.attempted} <small>correct</small></b></div><div><span>Connection required</span><b>None <small>for calculations</small></b></div></div><div class="section-title"><h2>Choose your next topic</h2><span>INPUT → WORKING → RESULT</span></div><div class="tool-grid">${cards}</div><div class="dashboard-lists"><section class="panel"><div class="section-title"><h2>Saved scenarios</h2><span>${state.workspace.saved.length}</span></div>${entries(state.workspace.saved, 'saved')}</section><section class="panel"><div class="section-title"><h2>Recent calculations</h2>${button('clear-history', 'Clear history')}</div>${entries(state.workspace.history.slice(0, 10), 'history')}</section></div>`;
  }
  function entries(list: Entry[], kind: string) {
    return list.length
      ? `<ul class="entries">${list.map((e) => `<li><button class="entry-open" data-action="open-entry" data-kind="${kind}" data-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>${esc(locationLabel(e.tab, e.values.mode))} · ${esc(e.summary)}</span><small>${esc(new Date(e.date).toLocaleString())}</small></button>${kind === 'saved' ? button('delete-entry', '×', `aria-label="Delete ${esc(e.name)}" data-id="${esc(e.id)}"`) : ''}</li>`).join('')}</ul>`
      : `<div class="empty-list"><span>◈</span><p>${kind === 'saved' ? 'Keep useful scenarios here. Calculate, give your scenario a name, and save it.' : 'Your calculations will appear here when history is enabled.'}</p></div>`;
  }
  function settings() {
    const p = state.workspace.preferences;
    return `<div class="settings-grid"><section class="panel"><h2>Display & explanations</h2><form id="preferences">${select(
      'theme',
      'Theme',
      p.theme,
      [
        ['system', 'System'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ],
    )}${select('method', 'Default methodology', p.method, methodOptions(['recommended', 'exam']))}${select(
      'detail',
      'Default detail level',
      p.detail,
      [
        ['full', 'Full Working'],
        ['standard', 'Standard'],
        ['exam', 'Short Exam Form'],
        ['final', 'Final Answer Only'],
      ],
    )}${checkbox('history', 'Keep local calculation history', p.history)}<p class="muted">Changes are saved automatically. Method and detail can be adjusted independently in each result.</p></form></section><section class="panel"><h2>Your local data</h2><p>Preferences, scenarios, history and practice scores are kept in this browser’s localStorage. Export a backup to move them to another browser or device.</p><div class="stack-actions">${button('export-all', 'Download JSON backup')}${button('import', 'Import JSON backup')}${button('clear-history', 'Clear history')}${button('reset-data', 'Reset all local data', 'class="danger"')}</div><div class="note">Imports merge scenarios and history, and apply the imported preferences. The existing browser data stays until you choose to reset it.</div><h3>Offline use</h3><p>Open <code>offline.html</code> from the downloaded build, or serve <code>dist/</code> locally. On localhost, the app caches its files after the first successful visit.</p><p>No backend, external APIs, remote fonts, analytics or account. Clearing browser data removes local saves.</p></section></div>`;
  }
  function workspacePage() {
    const d = data();
    const fields = formFields(state.tab, d.values, d.rows, toolFor(state.tab, d.values.mode).modes);
    const layoutControl = fields.includes('class="ipv4-field"')
      ? select('ipv4-layout', 'IPv4 input style', state.ipv4Layout, [
          ['full', 'Full address'],
          ['octets', 'Separate octets'],
        ])
      : '';
    return `<div class="workspace-grid"><section class="panel input-panel"><div class="panel-heading"><span class="step-badge">01</span><div><h2>Your inputs</h2><p>${state.tab === 'Practice' ? 'Choose a topic and difficulty.' : 'Enter actual network values.'}</p></div></div>${layoutControl ? `<div class="ipv4-style-control">${layoutControl}</div>` : ''}<form id="calculator">${fields}<div class="form-actions"><button type="submit" class="primary">${state.tab === 'Practice' ? 'Generate question' : 'Calculate & explain'} <span>→</span></button>${button('reset-form', 'Reset inputs')}</div></form><div class="privacy-note">◇ Calculated on your device.</div></section><section id="result" class="result-panel" aria-live="polite">${state.tab === 'Practice' ? practiceOutput() : resultOutput()}</section></div>`;
  }
  function methodControls(l: Lesson, method: string) {
    return `<div class="explanation-controls">${select(
      'explanation-method',
      'Methodology',
      method,
      methodOptions(Object.keys(l.methods)),
    )}${select('detail-level', 'Detail level', state.detail, [
      ['full', 'Full Working'],
      ['standard', 'Standard'],
      ['exam', 'Short Exam Form'],
      ['final', 'Final Answer Only'],
    ])}</div>`;
  }
  function working(l: Lesson, practice = false) {
    const method = resolveMethod(l, state.method);
    let steps = l.methods[method];
    if (state.detail === 'standard')
      steps = steps.length > 4 ? [steps[0], steps[1], steps.at(-2)!, steps.at(-1)!] : steps;
    if (state.detail === 'exam') steps = steps.length > 2 ? [steps[0], steps.at(-1)!] : steps;
    const hidden = practice || state.hintMode ? steps.slice(0, state.hintCount) : steps;
    return `${methodControls(l, method)}${state.detail !== 'final' ? `<div class="why"><strong>Why this method?</strong><p>${esc(methodWhy(l, method))}</p></div>${!practice ? checkbox('hint-mode', 'Progressive hint mode', state.hintMode) : ''}${practice || state.hintMode ? `<div class="hint-actions">${button('next-step', 'Show next step')}${button('show-working', 'Show full working')}${button('reveal', 'Reveal answer')}</div>` : ''}<p class="working-legend"><mark class="working-input">Input</mark> · <em class="working-rule">Rule</em> · <strong class="working-emphasis">Working</strong> · <strong class="working-result"><u>Result</u></strong></p><ol class="steps">${hidden.map((s) => `<li><strong>${esc(s.title)}</strong><pre>${renderStepText(s)}</pre></li>`).join('')}</ol>${hidden.length === 0 ? '<p class="muted">Use Show next step to begin.</p>' : ''}` : ''}`;
  }
  function resultOutput() {
    if (state.error)
      return `<div class="panel error" role="alert"><h2>Check your inputs</h2><p>${esc(state.error)}</p></div>`;
    if (!state.lesson)
      return `<div class="panel waiting"><span class="waiting-icon">⇆</span><h2>Make the working visible.</h2><p>Enter your values and calculate to see the answer, manual steps, and alternative methods.</p><div class="flow"><span>INPUT</span><b>→</b><span>WORKING</span><b>→</b><span>RESULT</span></div></div>`;
    const l = state.lesson;
    const show = state.detail === 'final' || !state.hintMode || state.answerRevealed;
    return `<div id="stale" class="notice ${state.stale ? '' : 'hidden'}">Inputs changed. Calculate again to update this result.</div><section class="panel working-panel"><div class="panel-heading"><span class="step-badge">02</span><div><h2>Manual working</h2><p>${esc(l.title)}</p></div></div>${working(l)}</section>${show ? `<section class="panel final-panel"><div class="panel-heading"><span class="step-badge">03</span><div><h2>Final result</h2><p>${esc(l.summary)}</p></div></div>${l.warnings?.length ? `<div class="warnings">${l.warnings.map((w) => `<p>⚠ ${esc(w)}</p>`).join('')}</div>` : ''}<dl class="metrics">${l.metrics.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${l.rows && l.columns ? table(l.columns, l.rows) : ''}${l.commands ? `<h3>Conceptual Cisco configuration</h3><pre class="command">${esc(l.commands)}</pre><p class="muted">Study configuration: adapt interfaces and syntax to your device and lab topology.</p>` : ''}<div class="output-actions">${button('copy-answer', 'Copy answer')}${button('copy-working', 'Copy working')}${l.commands ? button('copy-command', 'Copy commands') : ''}${l.rows ? button('copy-table', 'Copy table') + button('export-csv', 'Export CSV') : ''}${button('copy-markdown', 'Copy Markdown')}${button('export-result', 'Export notes')}${button('print', 'Print')}</div><div class="save-scenario">${field('scenario-name', 'Scenario name', state.scenarioName, 'text', 'For example: Campus VLAN Design')}${button('save-scenario', 'Save scenario', 'class="primary"')}${button('export-scenario', 'Export scenario')}</div></section>` : '<div class="panel note">Answer hidden. Work through the steps, then reveal when ready.</div>'}`;
  }
  function practiceOutput() {
    if (state.error)
      return `<div class="panel error" role="alert"><h2>Check your question settings</h2><p>${esc(state.error)}</p></div>`;
    if (!state.question)
      return `<div class="panel waiting"><span class="waiting-icon">✎</span><h2>Learn by doing.</h2><p>Generate a question, try your answer, and uncover the working one step at a time.</p></div>`;
    return `<section class="panel"><div class="eyebrow">PRACTICE · ${esc(state.question.topic)}</div><h2>${esc(state.question.prompt)}</h2><form id="practice-answer">${state.question.answers.map((a, i) => field(`answer-${i}`, a.label, state.practiceAnswers[`answer-${i}`] || '')).join('')}<button class="primary" type="submit">Check my answer</button></form><div class="feedback" role="status">${state.practiceFeedback.map((f) => `<p>${esc(f)}</p>`).join('')}</div><div class="hint-actions">${button('practice-hint', 'Show next hint')}${button('reveal', 'Reveal answer')}</div><ul class="practice-hints">${state.question.hints
      .slice(0, state.hintCount)
      .map((h) => `<li>${esc(h)}</li>`)
      .join(
        '',
      )}</ul>${state.answerRevealed ? `<div class="answer-note"><h3>Expected answers</h3>${state.question.answers.map((a) => `<p><strong>${esc(a.label)}:</strong> <code>${esc(a.value)}</code></p>`).join('')}</div>` : ''}</section><section class="panel"><h2>Manual working</h2>${state.practiceLesson ? working(state.practiceLesson, true) : ''}</section>`;
  }
  function outputText(kind = 'all') {
    if (!state.lesson) return '';
    const l = state.lesson;
    const method = resolveMethod(l, state.method);
    const metrics = l.metrics.map(([k, v]) => `${k}: ${v}`).join('\n');
    const steps = l.methods[method].map((s, i) => `${i + 1}. ${s.title}\n${s.text}`).join('\n\n');
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
            : `# ${l.title}\n\n## Inputs\n${Object.entries(state.snapshot?.values || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}\n${
                state.snapshot?.rows
                  .map((r) =>
                    Object.entries(r)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', '),
                  )
                  .join('\n') || ''
              }\n\n## Manual working (${methodLabels[method]})\n${steps}\n\n## Final result\n${metrics}\n\n${md}\n\n${l.commands ? '```text\n' + l.commands + '\n```' : ''}\n${l.warnings?.join('\n') || ''}`;
  }
  return { toolbar, dashboard, settings, workspacePage, resultOutput, practiceOutput, outputText };
}
