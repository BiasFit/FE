import { describe, expect, it } from "vitest";
import type { InfluencerProfile } from "../../../src/domain/scoring.js";
import { calculateTopThree, validateRankMatchInput } from "./top-three.js";

/**
 * 이 검증이 없던 동안 `styleScores`에서 스타일 하나만 빠져도 서버가 200을 냈다.
 * 점수는 NaN이 되어 JSON에서 `null`로 나가고, 정렬 비교자가 전부 NaN이라
 * **순위가 사실상 입력 순서로 무너졌다.** 그 조용한 실패를 막는 테스트다.
 */
const styleScores = {
  캐주얼: 40,
  로맨틱: 80,
  스트릿: 0,
  빈티지: 20,
  "오피스 & 비즈니스캐주얼": 10,
};

const personal = {
  mode: "personal",
  priority: "style_first",
  tpo: "new_semester",
  styleScores,
  avoidedStyle: "스트릿",
  bodyType: "웨이브",
  fitConcerns: ["전체 기장·비율"],
  budgetMinCode: 2,
  budgetMaxCode: 3,
  budgetApproach: "총액 절약형",
};

function profile(id: string, overrides: Partial<InfluencerProfile> = {}): InfluencerProfile {
  return {
    id,
    name: id.toUpperCase(),
    profileCompleted: true,
    primaryStyle: "로맨틱",
    secondaryStyle: "캐주얼",
    bodyType: "웨이브",
    fitConcerns: ["전체 기장·비율"],
    budgetCodes: [2, 3],
    budgetApproach: "총액 절약형",
    tpos: ["new_semester", "daily", "travel"],
    coachingType: "both",
    ...overrides,
  };
}

describe("validateRankMatchInput", () => {
  it("정상 입력은 그대로 통과한다", () => {
    const parsed = validateRankMatchInput(personal);
    expect(parsed.mode).toBe("personal");
    expect(parsed.priority).toBe("style_first");
  });

  it("스타일 점수가 하나라도 빠지면 거절한다", () => {
    const { 빈티지: _missing, ...partial } = styleScores;
    expect(() =>
      validateRankMatchInput({ ...personal, styleScores: partial }),
    ).toThrow(/빈티지/);
  });

  it("스타일 점수가 숫자가 아니면 거절한다", () => {
    expect(() =>
      validateRankMatchInput({
        ...personal,
        styleScores: { ...styleScores, 캐주얼: "40" },
      }),
    ).toThrow(/캐주얼/);
  });

  it("0점은 정상으로 받는다", () => {
    const zeroed = Object.fromEntries(Object.keys(styleScores).map((style) => [style, 0]));
    expect(() => validateRankMatchInput({ ...personal, styleScores: zeroed })).not.toThrow();
  });

  it("TPO 코드가 아니면 거절한다 — 라벨을 보내는 실수를 잡는다", () => {
    expect(() => validateRankMatchInput({ ...personal, tpo: "개강 행사" })).toThrow(/TPO/);
  });

  it("어휘가 어긋난 체형·구매 기준·비선호 스타일을 거절한다", () => {
    expect(() => validateRankMatchInput({ ...personal, bodyType: "스트레이트형" })).toThrow(/체형/);
    expect(() => validateRankMatchInput({ ...personal, budgetApproach: "절약형" })).toThrow(/구매 기준/);
    expect(() => validateRankMatchInput({ ...personal, avoidedStyle: "오피스" })).toThrow(/비선호/);
  });

  it("핏 고민 어휘가 어긋나면 거절한다", () => {
    expect(() =>
      validateRankMatchInput({ ...personal, fitConcerns: ["전체 기장"] }),
    ).toThrow(/핏 고민/);
  });

  it("예산 코드가 범위 밖이거나 정수가 아니면 거절한다", () => {
    expect(() => validateRankMatchInput({ ...personal, budgetMinCode: 0 })).toThrow(/최소 예산/);
    expect(() => validateRankMatchInput({ ...personal, budgetMaxCode: 99 })).toThrow(/최대 예산/);
    expect(() => validateRankMatchInput({ ...personal, budgetMaxCode: 2.5 })).toThrow(/최대 예산/);
  });

  it("우선순위와 스타일링 유형을 검사한다", () => {
    expect(() => validateRankMatchInput({ ...personal, priority: "price_first" })).toThrow(/우선순위/);
    expect(() => validateRankMatchInput({ ...personal, mode: "solo" })).toThrow(/스타일링 유형/);
  });

  it("그룹은 구성원 두 명을 모두 검사한다", () => {
    const { mode: _m, priority: _p, tpo: _t, ...member } = personal;
    const group = { mode: "group", priority: "style_first", tpo: "travel", members: [member, member] };
    expect(() => validateRankMatchInput(group)).not.toThrow();
    expect(() =>
      validateRankMatchInput({ ...group, members: [member, { ...member, bodyType: "없음" }] }),
    ).toThrow(/구성원 B/);
    expect(() => validateRankMatchInput({ ...group, members: [member] })).toThrow(/구성원 두 명/);
  });
});

describe("calculateTopThree", () => {
  it("점수가 NaN이 아닌 실제 숫자로 나온다", () => {
    const ranked = calculateTopThree(personal, [profile("a"), profile("b"), profile("c")]);
    expect(ranked).toHaveLength(3);
    for (const item of ranked) {
      expect(Number.isFinite(item.breakdown.matchScore)).toBe(true);
    }
  });

  it("한도에 찬 인플루언서는 후보에서 빠진다", () => {
    const ranked = calculateTopThree(personal, [profile("full"), profile("open")], {
      counts: { full: 3 },
      limits: { full: 3, open: 3 },
    });
    expect(ranked.map((item) => item.influencer.id)).toEqual(["open"]);
  });

  it("잘못된 입력은 계산 전에 던진다", () => {
    expect(() => calculateTopThree({ mode: "personal" }, [profile("a")])).toThrow();
  });
});
