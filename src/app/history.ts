import type { Entry, Workspace } from './storage';

export const HISTORY_LIMIT = 100;

export function mergeEntries(current: Entry[], incoming: Entry[]): Entry[] {
  return [...new Map([...current, ...incoming].map((e) => [e.id, e])).values()];
}

export function mergeHistory(current: Entry[], incoming: Entry[]): Entry[] {
  return mergeEntries(current, incoming)
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, HISTORY_LIMIT);
}

export function mergeWorkspace(current: Workspace, incoming: Workspace): Workspace {
  return {
    ...current,
    preferences: { ...incoming.preferences },
    saved: mergeEntries(current.saved, incoming.saved),
    history: mergeHistory(current.history, incoming.history),
    score: {
      correct: Math.max(current.score.correct, incoming.score.correct),
      attempted: Math.max(current.score.attempted, incoming.score.attempted),
    },
  };
}
