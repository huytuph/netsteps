import { Tab, tabs } from '../app/storage';
import { button, esc } from './ui';

interface ShellProps {
  tab: Tab;
  theme: 'system' | 'light' | 'dark';
  notice: string;
  description: string;
  tools: string;
  body: string;
}

export function renderShell({ tab, theme, notice, description, tools, body }: ShellProps): string {
  return `
    <a class="skip" href="#main">Skip to workspace</a>
    <header class="app-header">
      <div class="brand-block">
        <div class="eyebrow">OFFLINE NETWORK STUDY TOOLKIT</div>
        <a class="brand" href="#" data-tab="Dashboard" aria-label="NetSteps dashboard"><h1>NetSteps</h1></a>
        <p>Calculate networks. Understand every step.</p>
      </div>
      <div class="header-controls">
        <div class="top-actions"><span class="privacy-chip">● Browser only</span>${button('theme', theme === 'system' ? '◐ System' : theme === 'dark' ? '☾ Dark' : '☀ Light')}</div>
        <div class="header-meta"><strong>Private by design</strong><br>Your data stays in this browser.<br><span id="offline-status">Local calculations ready</span></div>
      </div>
    </header>
    <nav class="tabs" aria-label="Main navigation">${tabs.map((t) => `<button type="button" data-tab="${esc(t)}" class="nav-item ${t === tab ? 'active' : ''}" ${t === tab ? 'aria-current="page"' : ''}>${esc(t)}</button>`).join('')}</nav>
    <div class="shell">
      <main id="main">
        <div id="notice" role="status" class="notice ${notice ? '' : 'hidden'}">${esc(notice)}</div>
        <div class="page-heading"><div><h2 class="page-title">${esc(tab)}</h2><p>${esc(description)}</p></div>${tools}</div>
        ${body}
      </main>
      <footer><strong>NetSteps</strong><span>Offline-first · No account · No analytics</span></footer>
    </div>`;
}
