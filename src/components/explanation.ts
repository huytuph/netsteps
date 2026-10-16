import type { Step, TextPart } from '../explanations/model';
import { esc } from './ui';

function renderPart(part: TextPart): string {
  const text = esc(part.text);
  switch (part.style) {
    case 'input':
      return `<mark class="working-input">${text}</mark>`;
    case 'rule':
      return `<em class="working-rule">${text}</em>`;
    case 'result':
      return `<strong class="working-result"><u>${text}</u></strong>`;
    case 'emphasis':
      return `<strong class="working-emphasis">${text}</strong>`;
    case 'note':
      return `<em class="working-note">${text}</em>`;
    default:
      return text;
  }
}
export function renderStepText(step: Step): string {
  if (step.content) return step.content.map(renderPart).join('');
  // Older lessons also gain value contrast, without interpreting their text as HTML.
  return step.text
    .split(/(\b\d+(?:[.:/]\d+)*\b)/g)
    .map((text, i) => (i % 2 ? `<strong class="working-number">${esc(text)}</strong>` : esc(text)))
    .join('');
}
