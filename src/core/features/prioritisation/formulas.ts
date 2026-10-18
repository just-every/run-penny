import { z } from 'zod';

const weight = (initial = 0) => z.number().finite().min(-100).max(100).default(initial);
const weights = z.object({
  reach: weight(1),
  impact: weight(),
  confidence: weight(),
  effort: weight(),
  votes: weight(),
  accounts: weight(),
  evidence: weight(),
  importance1: weight(),
  importance2: weight(),
  importance3: weight(),
  importance4: weight(),
}).strict();

const manualInput = z.object({
  impact: z.number().finite().min(0).max(10).optional(),
  confidence: z.number().finite().min(0).max(100).optional(),
  effort: z.number().finite().positive().max(1e6).optional(),
  value: z.number().finite().min(0).max(1e12).optional(),
  segmentDemand: z.number().finite().min(0).max(1e9).optional(),
}).strict();

export const viewInput = z.object({
  name: z.string().trim().min(1).max(120),
  shared: z.boolean().default(false),
  entity: z.enum(['requests', 'features']).default('requests'),
  formula: z.enum(['none', 'rice', 'value_over_effort', 'weighted_segment_demand', 'weighted_sum']).default('none'),
  weights: weights.default(() => weights.parse({})),
  manualInputs: z.record(z.string().min(1), manualInput).default({}),
}).strict();

export type ViewInput = z.infer<typeof viewInput>;

export interface FormulaRow {
  id: string;
  title: string;
  votes: number;
  accounts: number;
  evidence: number;
  /** Counts for importance levels 1 through 4, in that order. */
  importance: number[];
}

export interface EvaluatedRow extends FormulaRow {
  inputs: Record<keyof ViewInput['weights'] | 'value' | 'segmentDemand', number | null>;
  weights: ViewInput['weights'];
  score: number | null;
  missing: string[];
}

/** Every displayed component is retained, including explicit absence of manual inputs. */
export function evaluate(row: FormulaRow, view: ViewInput): EvaluatedRow {
  const manual = Object.hasOwn(view.manualInputs, row.id) ? view.manualInputs[row.id] : undefined;
  const inputs: EvaluatedRow['inputs'] = {
    reach: row.votes,
    votes: row.votes,
    accounts: row.accounts,
    evidence: row.evidence,
    importance1: row.importance[0] ?? 0,
    importance2: row.importance[1] ?? 0,
    importance3: row.importance[2] ?? 0,
    importance4: row.importance[3] ?? 0,
    impact: manual?.impact ?? null,
    confidence: manual?.confidence ?? null,
    effort: manual?.effort ?? null,
    value: manual?.value ?? null,
    segmentDemand: manual?.segmentDemand ?? null,
  };
  const missing: string[] = [];
  const required = (key: keyof typeof inputs): number => {
    const value = inputs[key];
    if (value === null || !Number.isFinite(value)) {
      missing.push(key);
      return NaN;
    }
    return value;
  };
  let score: number | null = null;
  switch (view.formula) {
    case 'rice':
      score = required('reach') * required('impact') * (required('confidence') / 100) / required('effort');
      break;
    case 'value_over_effort':
      score = required('value') / required('effort');
      break;
    case 'weighted_segment_demand':
      // This is an operator-entered demand figure, not inferred segment membership.
      score = required('segmentDemand') * view.weights.reach;
      break;
    case 'weighted_sum':
      score = 0;
      for (const key of Object.keys(view.weights) as (keyof ViewInput['weights'])[]) {
        if (view.weights[key] !== 0) score += required(key) * view.weights[key];
      }
      break;
    case 'none':
      break;
  }
  if (score !== null && !Number.isFinite(score)) score = null;
  return { ...row, inputs, weights: { ...view.weights }, score, missing };
}

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function compareRows(a: EvaluatedRow, b: EvaluatedRow): number {
  if (a.score !== null && b.score === null) return -1;
  if (a.score === null && b.score !== null) return 1;
  if (a.score !== null && b.score !== null && a.score !== b.score) return a.score > b.score ? -1 : 1;
  return compareText(a.title, b.title) || compareText(a.id, b.id);
}

/** Evaluate and rank without mutating the caller's rows. Unscored views sort by title/id. */
export function sortRows(rows: readonly FormulaRow[], view: ViewInput): EvaluatedRow[] {
  return rows.map((row) => evaluate(row, view)).sort(compareRows);
}
