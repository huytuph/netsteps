export const tabs = [
  'Dashboard',
  'Number Systems',
  'Subnetting',
  'IPv6',
  'VLSM',
  'Static Routing',
  'VLAN/HSRP',
  'DHCP/NAT',
  'Tunnelling',
  'Distance Vector',
  'Frame Relay',
  'Practice',
  'Settings',
] as const;
export type Tab = (typeof tabs)[number];
export type Values = Record<string, string>;
export interface Entry {
  id: string;
  name: string;
  tab: Tab;
  values: Values;
  rows: Values[];
  date: string;
  summary: string;
}
export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  detail: 'full' | 'standard' | 'exam' | 'final';
  method: string;
  history: boolean;
}
export interface Workspace {
  version: 1;
  preferences: Preferences;
  saved: Entry[];
  history: Entry[];
  score: { correct: number; attempted: number };
}
export const defaults = (): Workspace => ({
  version: 1,
  preferences: { theme: 'system', detail: 'full', method: 'recommended', history: true },
  saved: [],
  history: [],
  score: { correct: 0, attempted: 0 },
});
const key = 'network-study-toolkit-v1';
export function validateWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== 'object') throw new Error('Backup must be a JSON object.');
  const v = value as Workspace;
  if (v.version !== 1 || !v.preferences || !Array.isArray(v.saved) || !Array.isArray(v.history))
    throw new Error('Unsupported backup format; expected NetSteps version 1.');
  if (
    !['system', 'light', 'dark'].includes(v.preferences.theme) ||
    !['full', 'standard', 'exam', 'final'].includes(v.preferences.detail) ||
    !['recommended', 'exam'].includes(v.preferences.method) ||
    typeof v.preferences.history !== 'boolean'
  )
    throw new Error('Invalid preferences in backup.');
  const validateEntry = (e: Entry) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      typeof e.name !== 'string' ||
      !tabs.includes(e.tab) ||
      !e.values ||
      typeof e.values !== 'object' ||
      Array.isArray(e.values) ||
      !Array.isArray(e.rows) ||
      typeof e.date !== 'string' ||
      typeof e.summary !== 'string'
    )
      throw new Error('Invalid saved scenario in backup.');
    if (
      Object.values(e.values).some((x) => typeof x !== 'string') ||
      e.rows.some(
        (r) =>
          !r ||
          typeof r !== 'object' ||
          Array.isArray(r) ||
          Object.values(r).some((x) => typeof x !== 'string'),
      )
    )
      throw new Error('Scenario fields must be text values.');
    return e;
  };
  if (v.saved.length > 1000 || v.history.length > 1000)
    throw new Error('Backup contains too many entries (maximum 1000 per list).');
  if (
    !v.score ||
    !Number.isSafeInteger(v.score.correct) ||
    !Number.isSafeInteger(v.score.attempted) ||
    v.score.correct < 0 ||
    v.score.correct > v.score.attempted
  )
    throw new Error('Invalid practice score.');
  return {
    version: 1,
    preferences: { ...v.preferences },
    saved: v.saved.map(validateEntry),
    history: v.history.map(validateEntry).slice(0, 100),
    score: { ...v.score },
  };
}
export function load(): { workspace: Workspace; error?: string } {
  try {
    const value = localStorage.getItem(key);
    return { workspace: value ? validateWorkspace(JSON.parse(value)) : defaults() };
  } catch {
    return {
      workspace: defaults(),
      error:
        'Browser storage is unavailable or contains an invalid backup. Export your work before closing this session.',
    };
  }
}
export function persist(workspace: Workspace): void {
  try {
    localStorage.setItem(key, JSON.stringify(workspace));
  } catch {
    throw new Error(
      'Browser storage is unavailable or full. Your work remains in this session; export a backup to keep it.',
    );
  }
}
export function entry(
  tab: Tab,
  values: Values,
  rows: Values[],
  name: string,
  summary: string,
): Entry {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name,
    tab,
    values: { ...values },
    rows: rows.map((r) => ({ ...r })),
    summary,
    date: new Date().toISOString(),
  };
}
