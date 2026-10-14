import type { Tab, Values } from '../../app/storage';
import type { Lesson } from '../../explanations/model';
import { feature as distanceVector } from './distance-vector';
import { feature as dynamicNat } from './dynamic-nat';
import { feature as frameRelay } from './frame-relay';
import { feature as ospfv3 } from './ospfv3';
import { feature as tunnelling } from './tunnelling';
export interface Feature {
  tab: Tab;
  mode?: string;
  defaults?: Values;
  row?: Values;
  render(values: Values, rows: Values[]): string;
  calculate(values: Values, rows: Values[]): Lesson;
}
export const features: readonly Feature[] = [
  dynamicNat,
  tunnelling,
  distanceVector,
  frameRelay,
  ospfv3,
];
export const featureDefaults = Object.fromEntries(
  features.filter((f) => f.defaults).map((f) => [f.tab, f.defaults]),
) as Partial<Record<Tab, Values>>;
export function featureFor(tab: Tab, values: Values): Feature | undefined {
  return features.find((f) => f.tab === tab && (f.mode === undefined || f.mode === values.mode));
}
export function featureRow(tab: Tab, mode: string): Values | undefined {
  const row = featureFor(tab, { mode })?.row;
  return row && { ...row };
}
