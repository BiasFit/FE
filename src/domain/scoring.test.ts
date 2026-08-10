import { describe, expect, it } from "vitest";
import {
  applyPriorityWeights,
  calculateGroupCompatibility,
  calculateGroupMatchScore,
  calculateInfluencerMatch,
  calculateStyleScores,
  filterEligibleInfluencers,
  normalizeMatchScore,
  rankInfluencers,
} from "./scoring";
import { MATCH_PRIORITY_WEIGHTS } from "./matchPriority";
import {
  isPriorityOptionsResponse,
  validateStyleDnaExplanation,
} from "./aiContracts";

describe("AI response contracts", () => {
  it("accepts exactly the four fixed priority codes", () => {
    expect(
      isPriorityOptionsResponse({
        question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
        options: [
          { code: "style_first", label: "스타일", evidenceRefs: ["preferredStyle"] },
          { code: "fit_first", label: "핏", evidenceRefs: ["fitConcerns"] },
          { code: "budget_first", label: "예산", evidenceRefs: ["budgetApproach"] },
          { code: "tpo_first", label: "TPO", evidenceRefs: ["tpo"] },
        ],
      }),
    ).toBe(true);
    expect(
      isPriorityOptionsResponse({
        question: "질문",
        options: [
          { code: "ai_decides", label: "AI가 선택", evidenceRefs: ["tpo"] },
        ],
      }),
    ).toBe(false);
  });

  it("rejects a personal Style DNA explanation without grounded points", () => {
    expect(() =>
      validateStyleDnaExplanation({
        mode: "personal",
        personalStyleDnaSummary: "단정한 인상을 고려한 스타일",
        personalMatchingPoints: [
          { text: "근거가 없는 설명이에요", evidenceRefs: [] },
          { text: "TPO를 함께 고려해요", evidenceRefs: ["personal.tpo"] },
        ],
      }),
    ).toThrow("evidenceRefs");
  });
});

describe("calculateStyleScores", () => {
  it("calculates the P1 Style DNA scores from fixed style signals", () => {
    const result = calculateStyleScores({
      preferredStyle: "로맨틱",
      avoidedStyle: "스트릿",
      keywords: ["부드러운", "사랑스러운", "자연스러운"],
      designElements: ["리본", "셔링", "데님 소재감"],
      preferredItems: [
        "A라인·플레어 스커트",
        "메리제인 슈즈",
        "기본 가디건",
      ],
      avoidedElements: ["정장처럼 딱딱한 룩"],
    });

    expect(result).toEqual({
      캐주얼: 40,
      로맨틱: 75,
      스트릿: 0,
      빈티지: 15,
      "오피스 & 비즈니스캐주얼": 10,
    });
  });

  it("calculates the P5 Style DNA scores without overwriting P4", () => {
    const result = calculateStyleScores({
      preferredStyle: "오피스 & 비즈니스캐주얼",
      avoidedStyle: "로맨틱",
      keywords: ["단정한", "깔끔한", "클래식한"],
      designElements: ["테일러드 구조", "톤온톤 색감", "체크 패턴"],
      preferredItems: ["셔츠", "슬랙스", "니트 베스트"],
      avoidedElements: ["지나치게 편한 일상복 느낌"],
    });

    expect(result).toEqual({
      캐주얼: 10,
      로맨틱: 0,
      스트릿: 15,
      빈티지: 40,
      "오피스 & 비즈니스캐주얼": 75,
    });
  });
});

describe("calculateGroupCompatibility", () => {
  it("returns the fixed P4/P5 compatibility score of 61", () => {
    const result = calculateGroupCompatibility(
      {
        scores: {
          캐주얼: 75,
          로맨틱: 40,
          스트릿: 10,
          빈티지: 15,
          "오피스 & 비즈니스캐주얼": 0,
        },
        avoidedStyle: "오피스 & 비즈니스캐주얼",
        budgetCode: 2,
      },
      {
        scores: {
          캐주얼: 10,
          로맨틱: 0,
          스트릿: 15,
          빈티지: 40,
          "오피스 & 비즈니스캐주얼": 75,
        },
        avoidedStyle: "로맨틱",
        budgetCode: 3,
      },
    );

    expect(result).toEqual({
      styleSimilarity: 41,
      budgetCompatibility: 20,
      total: 61,
    });
  });
});

describe("calculateGroupMatchScore", () => {
  it("weights the lower member score at 70 percent", () => {
    const result = calculateGroupMatchScore({
      memberA: { style: 24, fit: 18, budget: 15 },
      memberB: { style: 18, fit: 25, budget: 8 },
      sharedTpo: 20,
    });

    expect(result).toEqual({
      style: 19,
      fit: 19,
      budget: 9,
      tpo: 20,
      rawTotal: 67,
      matchScore: 74,
    });
  });
});

describe("priority weighting", () => {
  it("keeps every personal and group priority profile at 90 raw points", () => {
    for (const mode of ["personal", "group"] as const) {
      for (const weights of Object.values(MATCH_PRIORITY_WEIGHTS[mode])) {
        expect(
          weights.style + weights.fit + weights.budget + weights.tpo,
        ).toBe(90);
      }
    }
  });

  it("applies only the selected category weights and normalizes to 100", () => {
    const weighted = applyPriorityWeights(
      { style: 15, fit: 25, budget: 10, tpo: 15 },
      "personal",
      "fit_first",
    );

    expect(weighted).toEqual({
      style: 12.5,
      fit: 30,
      budget: 10,
      tpo: 15,
      rawTotal: 67.5,
      matchScore: 75,
    });
    expect(normalizeMatchScore(67.5)).toBe(75);
  });
});

describe("calculateInfluencerMatch", () => {
  it("calculates a personal match from Style DNA, fit, budget and TPO", () => {
    const result = calculateInfluencerMatch(
      {
        mode: "personal",
        styleScores: {
          캐주얼: 40,
          로맨틱: 75,
          스트릿: 0,
          빈티지: 15,
          "오피스 & 비즈니스캐주얼": 10,
        },
        avoidedStyle: "스트릿",
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율", "밑위·하의 길이"],
        budgetMinCode: 2,
        budgetMaxCode: 2,
        budgetApproach: "가성비 중심",
        tpo: "개강·새학기",
      },
      {
        id: "stylemate-01",
        name: "STYLEMATE 01",
        profileCompleted: true,
        primaryStyle: "로맨틱",
        secondaryStyle: "캐주얼",
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율", "밑위·하의 길이"],
        budgetCodes: [2, 3],
        budgetApproach: "가성비 중심",
        tpos: ["개강·새학기", "여행·사진"],
        coachingType: "both",
      },
    );

    expect(result).toEqual({
      style: 19,
      fit: 25,
      budget: 20,
      tpo: 15,
      rawTotal: 79,
      matchScore: 88,
    });
  });

  it("sets an avoided representative style to zero before weighting", () => {
    const result = calculateInfluencerMatch(
      {
        mode: "personal",
        styleScores: {
          캐주얼: 40,
          로맨틱: 75,
          스트릿: 70,
          빈티지: 15,
          "오피스 & 비즈니스캐주얼": 10,
        },
        avoidedStyle: "스트릿",
        bodyType: "웨이브",
        fitConcerns: [],
        budgetMinCode: 2,
        budgetMaxCode: 2,
        budgetApproach: "가성비 중심",
        tpo: "개강·새학기",
      },
      {
        id: "street-only",
        name: "STREET MATE",
        profileCompleted: true,
        primaryStyle: "스트릿",
        secondaryStyle: "빈티지",
        bodyType: "내추럴",
        fitConcerns: [],
        budgetCodes: [5],
        budgetApproach: "투자 아이템 중심",
        tpos: ["축제·공연"],
        coachingType: "group",
      },
    );

    expect(result.style).toBe(2);
  });
});

describe("rankInfluencers", () => {
  it("filters coaching support before calculating scores", () => {
    const profiles = [
      {
        id: "personal",
        name: "PERSONAL",
        profileCompleted: true,
        primaryStyle: "캐주얼" as const,
        secondaryStyle: "로맨틱" as const,
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetCodes: [2],
        budgetApproach: "가성비 중심",
        tpos: ["여행·사진"],
        coachingType: "personal" as const,
      },
      {
        id: "group",
        name: "GROUP",
        profileCompleted: true,
        primaryStyle: "캐주얼" as const,
        secondaryStyle: "로맨틱" as const,
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetCodes: [2],
        budgetApproach: "가성비 중심",
        tpos: ["여행·사진"],
        coachingType: "group" as const,
      },
    ];

    expect(filterEligibleInfluencers("personal", profiles).map(({ id }) => id)).toEqual([
      "personal",
    ]);
    expect(filterEligibleInfluencers("group", profiles).map(({ id }) => id)).toEqual([
      "group",
    ]);
  });

  it("excludes incomplete and personal-only profiles from group candidates", () => {
    const profiles = [
      {
        id: "both",
        name: "BOTH",
        profileCompleted: true,
        primaryStyle: "캐주얼" as const,
        secondaryStyle: "로맨틱" as const,
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetCodes: [2],
        budgetApproach: "가성비 중심",
        tpos: ["여행·사진"],
        coachingType: "both" as const,
      },
      {
        id: "personal",
        name: "PERSONAL",
        profileCompleted: true,
        primaryStyle: "캐주얼" as const,
        secondaryStyle: "로맨틱" as const,
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetCodes: [2],
        budgetApproach: "가성비 중심",
        tpos: ["여행·사진"],
        coachingType: "personal" as const,
      },
      {
        id: "incomplete",
        name: "INCOMPLETE",
        profileCompleted: false,
        primaryStyle: "캐주얼" as const,
        secondaryStyle: "로맨틱" as const,
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetCodes: [2],
        budgetApproach: "가성비 중심",
        tpos: ["여행·사진"],
        coachingType: "group" as const,
      },
    ];

    const results = rankInfluencers(
      {
        mode: "group",
        members: [
          {
            styleScores: {
              캐주얼: 75,
              로맨틱: 40,
              스트릿: 10,
              빈티지: 15,
              "오피스 & 비즈니스캐주얼": 0,
            },
            avoidedStyle: "오피스 & 비즈니스캐주얼",
            bodyType: "웨이브",
            fitConcerns: ["전체 기장·비율", "밑위·하의 길이"],
            budgetMinCode: 2,
            budgetMaxCode: 2,
            budgetApproach: "가성비 중심",
          },
          {
            styleScores: {
              캐주얼: 10,
              로맨틱: 0,
              스트릿: 15,
              빈티지: 40,
              "오피스 & 비즈니스캐주얼": 75,
            },
            avoidedStyle: "로맨틱",
            bodyType: "내추럴",
            fitConcerns: ["가슴·상체 여유", "어깨선·소매 길이"],
            budgetMinCode: 3,
            budgetMaxCode: 3,
            budgetApproach: "균형형",
          },
        ],
        tpo: "여행·사진",
        priority: "style_first",
      },
      profiles,
    );

    expect(results.map((result) => result.influencer.id)).toEqual(["both"]);
  });

  it("uses a stable influencer id tie break for identical scores", () => {
    const baseProfile = {
      name: "MATE",
      profileCompleted: true,
      primaryStyle: "캐주얼" as const,
      secondaryStyle: "로맨틱" as const,
      bodyType: "웨이브",
      fitConcerns: ["전체 기장·비율"],
      budgetCodes: [2],
      budgetApproach: "가성비 중심",
      tpos: ["개강·새학기"],
      coachingType: "personal" as const,
    };
    const results = rankInfluencers(
      {
        mode: "personal",
        priority: "style_first",
        styleScores: {
          캐주얼: 70,
          로맨틱: 60,
          스트릿: 0,
          빈티지: 10,
          "오피스 & 비즈니스캐주얼": 10,
        },
        avoidedStyle: "스트릿",
        bodyType: "웨이브",
        fitConcerns: ["전체 기장·비율"],
        budgetMinCode: 2,
        budgetMaxCode: 2,
        budgetApproach: "가성비 중심",
        tpo: "개강·새학기",
      },
      [
        { ...baseProfile, id: "stylemate-b" },
        { ...baseProfile, id: "stylemate-a" },
      ],
    );

    expect(results.map(({ influencer }) => influencer.id)).toEqual([
      "stylemate-a",
      "stylemate-b",
    ]);
  });
});
