export interface Step {
  title: string;
  text: string;
}
export interface Lesson {
  title: string;
  summary: string;
  metrics: [string, string][];
  methods: Record<string, Step[]>;
  why: string;
  columns?: string[];
  rows?: string[][];
  commands?: string;
  warnings?: string[];
}
