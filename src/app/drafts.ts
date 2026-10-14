import { baseValues, initialRows } from '../pages/forms';
import type { Draft } from './state';
import type { Entry, Tab, Values } from './storage';

/** Drafts are transient; the version-1 saved-scenario format remains unchanged. */
export class DraftStore {
  private drafts = new Map<Tab, Map<string, Draft>>();
  private active = new Map<Tab, string>();

  private defaultMode(tab: Tab): string {
    return baseValues[tab]?.mode || '';
  }
  mode(tab: Tab): string {
    return this.active.get(tab) ?? this.defaultMode(tab);
  }
  get(tab: Tab): Draft {
    const mode = this.mode(tab);
    let modes = this.drafts.get(tab);
    if (!modes) this.drafts.set(tab, (modes = new Map()));
    let draft = modes.get(mode);
    if (!draft) {
      draft = {
        values: { ...baseValues[tab], ...(mode ? { mode } : {}) },
        rows: initialRows(tab, mode),
      };
      modes.set(mode, draft);
    }
    return draft;
  }
  capture(tab: Tab, values: Values, rows?: Values[]): void {
    const d = this.get(tab);
    // A select change fires after its value changes. Capture the outgoing form
    // under its previous mode, then let switchMode select the new draft.
    d.values = { ...d.values, ...values, ...(this.mode(tab) ? { mode: this.mode(tab) } : {}) };
    if (rows) d.rows = rows.map((r) => ({ ...r }));
  }
  switchMode(tab: Tab, mode: string): Draft {
    this.active.set(tab, mode);
    return this.get(tab);
  }
  reset(tab: Tab): void {
    const mode = this.mode(tab);
    this.drafts.get(tab)?.delete(mode);
  }
  restore(entry: Entry): void {
    this.active.set(entry.tab, entry.values.mode || this.defaultMode(entry.tab));
    const d = this.get(entry.tab);
    d.values = { ...baseValues[entry.tab], ...entry.values };
    d.rows = entry.rows.map((r) => ({ ...r }));
  }
  clear(): void {
    this.drafts.clear();
    this.active.clear();
  }
}
