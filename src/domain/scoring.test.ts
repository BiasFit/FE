import { describe, expect, it } from "vitest";
import {
  calculateGroupCompatibility,
  calculateGroupMatchScore,
  calculateInfluencerMatch,
  calculateStyleScores,
  rankInfluencers,
} from "./scoring";

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
      memberA: { style: 24, fit: 18, budget: 20 },
      memberB: { style: 18, fit: 25, budget: 8 },
      sharedTpo: 15,
      coachingType: 10,
    });

    expect(result).toEqual({
      style: 19,
      fit: 19,
      budget: 10,
      tpo: 15,
      coachingType: 10,
      total: 73,
    });
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
        budgetCode: 2,
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
      coachingType: 10,
      total: 89,
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
        budgetCode: 2,
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
    expect(result.coachingType).toBe(0);
  });
});

describe("rankInfluencers", () => {
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
            budgetCode: 2,
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
            budgetCode: 3,
            budgetApproach: "균형형",
          },
        ],
        tpo: "여행·사진",
      },
      profiles,
    );

    expect(results.map((result) => result.influencer.id)).toEqual(["both"]);
  });
});
