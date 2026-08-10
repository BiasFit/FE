import { describe, expect, it } from "vitest";
import { personaForms } from "../data/personas";
import { MATCH_PRIORITY_WEIGHTS } from "./matchPriority";
import {
  calculateGroupCompatibility,
  calculateGroupMatchScore,
  calculatePersonalBaseBreakdown,
  calculateStyleScores,
  rankInfluencers,
  type InfluencerProfile,
  type StyleScores,
} from "./scoring";

const zeroScores: StyleScores = {
  캐주얼: 0,
  로맨틱: 0,
  스트릿: 0,
  빈티지: 0,
  "오피스 & 비즈니스캐주얼": 0,
};

function scoresForPersona(personaId: keyof typeof personaForms) {
  const form = personaForms[personaId];
  return calculateStyleScores({
    preferredStyle: form.preferredStyle,
    avoidedStyle: form.avoidedStyle,
    keywords: form.keywords,
    designElements: form.designElements,
    preferredItems: form.preferredItems,
    avoidedElements: form.avoidedElements,
  });
}

describe("latest Style DNA scoring rules", () => {
  it.each([
    ["P1", [48, 67, 0, 23, 18]],
    ["P2", [10, 8, 15, 15, 100]],
    ["P3", [15, 35, 0, 15, 83]],
    ["P4", [75, 40, 10, 15, 0]],
    ["P5", [10, 8, 15, 15, 100]],
  ] as const)("calculates the %s score vector from the latest option map", (personaId, expected) => {
    expect(Object.values(scoresForPersona(personaId))).toEqual(expected);
  });

  it("keeps multi-style choices at full value for every fixed linked style", () => {
    const scores = calculateStyleScores({
      preferredStyle: "캐주얼",
      avoidedStyle: "로맨틱",
      keywords: ["편안한", "래퍼여친", "레트로"],
      designElements: ["무채색", "레이스", "플라워 패턴"],
      preferredItems: ["쉬폰 블라우스", "플리츠 니트", "데님 팬츠"],
      avoidedElements: [],
    });

    expect(scores.캐주얼).toBe(50);
    expect(scores.스트릿).toBe(32);
    expect(scores.로맨틱).toBe(33);
    expect(scores.빈티지).toBe(40);
    expect(scores["오피스 & 비즈니스캐주얼"]).toBe(32);
  });

  it("keeps the P4/P5 group compatibility at 61", () => {
    const p4 = personaForms.P4;
    const p5 = personaForms.P5;
    expect(calculateGroupCompatibility(
      { scores: scoresForPersona("P4"), avoidedStyle: p4.avoidedStyle, budgetCode: p4.budgetCode },
      { scores: scoresForPersona("P5"), avoidedStyle: p5.avoidedStyle, budgetCode: p5.budgetCode },
    )).toEqual({ styleSimilarity: 41, budgetCompatibility: 20, total: 61 });
  });
});

describe("individual and group matching rules", () => {
  const fullFitProfile: InfluencerProfile = {
    id: "fit-profile", name: "FIT PROFILE", profileCompleted: true,
    primaryStyle: "캐주얼", secondaryStyle: "로맨틱", bodyType: "웨이브",
    fitConcerns: ["전체 기장·비율", "밑위·하의 길이"], budgetCodes: [2],
    budgetApproach: "총액 절약형", tpos: ["개강 행사"], coachingType: "both",
  };

  it("uses 15 body points and proportional fit-concern points for an individual", () => {
    const base = calculatePersonalBaseBreakdown({
      mode: "personal", priority: "fit_first", styleScores: zeroScores, avoidedStyle: "스트릿",
      bodyType: "웨이브", fitConcerns: ["전체 기장·비율", "가슴·상체 여유"],
      budgetMinCode: 2, budgetMaxCode: 3, budgetApproach: "총액 절약형", tpo: "개강 행사",
    }, fullFitProfile);

    expect(base.fit).toBe(20);
    expect(base.budget).toBe(20);
  });

  it("gives I1 25 and I2 10 for the same two fit concerns", () => {
    const input = {
      mode: "personal" as const, priority: "fit_first" as const, styleScores: zeroScores,
      avoidedStyle: "스트릿" as const, fitConcerns: ["전체 기장·비율", "밑위·하의 길이"],
      budgetMinCode: 2, budgetMaxCode: 2, budgetApproach: "총액 절약형", tpo: "개강 행사",
    };
    expect(calculatePersonalBaseBreakdown({ ...input, bodyType: "웨이브" }, fullFitProfile).fit).toBe(25);
    expect(calculatePersonalBaseBreakdown({ ...input, bodyType: "내추럴" }, fullFitProfile).fit).toBe(10);
  });

  it("excludes body type and aggregates group range and approach budgets separately", () => {
    const results = rankInfluencers({
      mode: "group", priority: "tpo_first", tpo: "여행",
      members: [
        { styleScores: zeroScores, avoidedStyle: "스트릿", bodyType: "웨이브", fitConcerns: ["전체 기장·비율"], budgetMinCode: 2, budgetMaxCode: 2, budgetApproach: "총액 절약형" },
        { styleScores: zeroScores, avoidedStyle: "스트릿", bodyType: "내추럴", fitConcerns: ["가슴·상체 여유"], budgetMinCode: 3, budgetMaxCode: 3, budgetApproach: "일상 활용형" },
      ],
    }, [{
      ...fullFitProfile, id: "group-profile", bodyType: "스트레이트",
      fitConcerns: ["전체 기장·비율", "가슴·상체 여유"], budgetCodes: [2], tpos: ["여행"],
    }]);

    expect(results[0].baseBreakdown.fit).toBe(25);
    expect(results[0].baseBreakdown.budget).toBe(7);
  });

  it("uses the lower member at 70 percent and the average at 30 percent", () => {
    expect(calculateGroupMatchScore({
      memberA: { style: 24, fit: 18, budget: 7 },
      memberB: { style: 18, fit: 25, budget: 7 },
      sharedTpo: 20,
    })).toEqual({ style: 19, fit: 19, budget: 7, tpo: 20, rawTotal: 65, matchScore: 72 });
  });
});

describe("priority weights", () => {
  it("keeps every individual and group profile at 90 raw points", () => {
    for (const mode of ["personal", "group"] as const) {
      for (const weights of Object.values(MATCH_PRIORITY_WEIGHTS[mode])) {
        expect(weights.style + weights.fit + weights.budget + weights.tpo).toBe(90);
      }
    }
  });
});
