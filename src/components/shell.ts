import { sections, sectionMetadata, toolFor, toolsIn } from '../app/navigation';
import type { Tab } from '../app/storage';
import { button, esc } from './ui';

interface ShellProps {
  tab: Tab;
  mode?: string;
  theme: 'system' | 'light' | 'dark';
  notice: string;
  description: string;
  tools: string;
  body: string;
}

export function renderShell({
  tab,
  mode,
  theme,
  notice,
  description,
  tools,
  body,
}: ShellProps): string {
  const current = toolFor(tab, mode);
  const siblings = toolsIn(current.section);
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
    <nav class="tabs" aria-label="Main navigation">${sections.map((section) => `<button type="button" data-section="${esc(section)}" class="nav-item ${section === current.section ? 'active' : ''}" ${section === current.section ? 'aria-current="page"' : ''}>${esc(section)}</button>`).join('')}</nav>
    <div class="shell">
      <main id="main">
        <div id="notice" role="status" class="notice ${notice ? '' : 'hidden'}">${esc(notice)}</div>
        <div class="page-heading"><div><h2 class="page-title">${esc(current.section)}</h2><p>${esc(sectionMetadata[current.section].description)}</p></div>${tools}</div>
        ${siblings.length > 1 ? `<nav class="subtabs" aria-label="${esc(current.section)} tools">${siblings.map((tool) => `<button type="button" data-tool="${esc(tool.id)}" class="subnav-item ${tool.id === current.id ? 'active' : ''}" ${tool.id === current.id ? 'aria-current="page"' : ''}>${esc(tool.label)}</button>`).join('')}</nav><div class="tool-heading"><h3>${esc(current.label)}</h3><p>${esc(current.description || description)}</p></div>` : ''}
        ${body}
      </main>
      <footer><strong>NetSteps</strong><span>Offline-first · No account · No analytics</span></footer>
    </div>`;
}
