export function requiredNumber(value: string, label: string): number {
  if (!value?.trim()) throw new Error(`Enter ${label.toLowerCase()}.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number.`);
  return n;
}
export const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
export const words = (text: string): string[] => text.split(/[\s,]+/).filter(Boolean);
export function choice<const T extends readonly string[]>(
  value: string,
  choices: T,
  label: string,
): T[number] {
  if (!choices.includes(value)) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  return value as T[number];
}
