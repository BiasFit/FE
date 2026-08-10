import type { MatchPriority } from "../app/types";

export type MatchMode = "personal" | "group";
export type MatchCategory = "style" | "fit" | "budget" | "tpo";
export type CategoryScores = Record<MatchCategory, number>;

export const BASE_MATCH_WEIGHTS: Record<MatchMode, CategoryScores> = {
  personal: { style: 30, fit: 25, budget: 20, tpo: 15 },
  group: { style: 30, fit: 25, budget: 15, tpo: 20 },
};

export const MATCH_PRIORITY_WEIGHTS: Record<
  MatchMode,
  Record<MatchPriority, CategoryScores>
> = {
  personal: {
    style_first: { style: 30, fit: 25, budget: 20, tpo: 15 },
    fit_first: { style: 25, fit: 30, budget: 20, tpo: 15 },
    budget_first: { style: 25, fit: 20, budget: 30, tpo: 15 },
    tpo_first: { style: 25, fit: 20, budget: 15, tpo: 30 },
  },
  group: {
    style_first: { style: 30, fit: 25, budget: 15, tpo: 20 },
    fit_first: { style: 25, fit: 30, budget: 15, tpo: 20 },
    budget_first: { style: 25, fit: 20, budget: 25, tpo: 20 },
    tpo_first: { style: 25, fit: 20, budget: 15, tpo: 30 },
  },
};

export const PRIORITY_CATEGORY: Record<MatchPriority, MatchCategory> = {
  style_first: "style",
  fit_first: "fit",
  budget_first: "budget",
  tpo_first: "tpo",
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeMatchScore(rawTotal: number) {
  return Math.round((rawTotal / 90) * 100);
}

export function applyPriorityWeights(
  scores: CategoryScores,
  mode: MatchMode,
  priority: MatchPriority,
) {
  const base = BASE_MATCH_WEIGHTS[mode];
  const target = MATCH_PRIORITY_WEIGHTS[mode][priority];
  const weighted = Object.fromEntries(
    (Object.keys(base) as MatchCategory[]).map((category) => [
      category,
      roundToTwo((scores[category] / base[category]) * target[category]),
    ]),
  ) as CategoryScores;
  const rawTotal = roundToTwo(
    weighted.style + weighted.fit + weighted.budget + weighted.tpo,
  );

  return {
    ...weighted,
    rawTotal,
    matchScore: normalizeMatchScore(rawTotal),
  };
}
