import type { Step, TextPart } from './model';

/** Semantic text only: rendering and escaping belong to the UI layer. */
export function formattedStep(title: string, ...content: (string | TextPart)[]): Step {
  const parts = content.map((part) => (typeof part === 'string' ? { text: part } : part));
  return { title, text: parts.map((part) => part.text).join(''), content: parts };
}
export const inputValue = (text: string): TextPart => ({ text, style: 'input' });
export const rule = (text: string): TextPart => ({ text, style: 'rule' });
export const result = (text: string): TextPart => ({ text, style: 'result' });
export const emphasis = (text: string): TextPart => ({ text, style: 'emphasis' });
export const note = (text: string): TextPart => ({ text, style: 'note' });
