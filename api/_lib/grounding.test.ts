import { describe, expect, it } from "vitest";
import { personaForms } from "../../src/data/personas";
import { assertGrounded, findUngroundedTerms } from "./grounding";

// P4 캐주얼 / P5 오피스 & 비즈니스캐주얼 — 실측에서 AI1이 "빈티지"를 만들어 낸 그룹
const groupForms = [personaForms.P4, personaForms.P5];

describe("findUngroundedTerms", () => {
  it("flags a style nobody chose", () => {
    expect(
      findUngroundedTerms("찾고 있는 빈티지 분위기를 가장 먼저 고려하고 싶어요.", groupForms),
    ).toContain("빈티지 (아무도 고르지 않은 스타일)");
  });

  it("allows the styles the members actually chose", () => {
    expect(
      findUngroundedTerms("편안한 캐주얼과 단정한 비즈니스캐주얼을 함께 살려요.", groupForms),
    ).toEqual([]);
  });

  it("does not mistake 비즈니스캐주얼 for 캐주얼", () => {
    // P3는 오피스를 고르고 캐주얼은 고르지 않았다.
    const terms = findUngroundedTerms("단정한 비즈니스캐주얼 인상이 좋아요.", [personaForms.P3]);
    expect(terms).toEqual([]);
  });

  it("allows a style name that appears inside a chosen option", () => {
    // 빈티지 워싱 데님을 고른 사용자에게 빈티지 언급은 허용한다.
    const form = {
      ...personaForms.P1,
      preferredStyle: "캐주얼" as const,
      preferredItems: ["빈티지 워싱 데님", "데님 팬츠", "에코백"],
    };
    expect(findUngroundedTerms("빈티지 무드를 살린 조합이에요.", [form])).toEqual([]);
  });

  it("flags a colour the user never chose", () => {
    expect(findUngroundedTerms("수채화 색감을 더하면 좋아요.", groupForms)).toContain(
      "수채화 색감 (고르지 않은 색상·소재)",
    );
  });

  it("allows a colour the user did choose", () => {
    const form = { ...personaForms.P1, designElements: ["더스티 컬러", "빈티지 워싱", "믹스 패턴"] };
    expect(findUngroundedTerms("더스티 컬러가 잘 어울려요.", [form])).toEqual([]);
  });
});

describe("assertGrounded", () => {
  it("throws with the offending term so the retry can fix it", () => {
    expect(() => assertGrounded(["빈티지 분위기가 중요해요."], groupForms)).toThrow(
      "사용자가 고르지 않은 내용",
    );
  });

  it("passes when every sentence stays inside the selections", () => {
    expect(() =>
      assertGrounded(["편안한 캐주얼 무드와 단정한 인상을 함께 살려요."], groupForms),
    ).not.toThrow();
  });
});
