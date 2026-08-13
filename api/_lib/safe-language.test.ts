import { describe, expect, it } from "vitest";
import { assertSafeLanguage, findUnsafePhrases } from "./safe-language.js";

describe("findUnsafePhrases", () => {
  // 실제 AI1 출력에서 관찰된 위반 문구들
  it.each([
    "사진에서 다리가 짧아 보이지 않도록 하의 길이 균형이 중요해요.",
    "전체 기장 비율에 신경 써서 다리가 길어 보이게 하고 싶어요.",
    "전체 기장과 비율을 맞춰서 날씬해 보이는 게 중요해요.",
    "살쪄 보이지 않게 골라주세요.",
    "단점을 가려야 해요.",
    "몸매 보완형 스타일이에요.",
    "체형 등급이 높아요.",
  ])("flags %s", (text) => {
    expect(findUnsafePhrases(text).length).toBeGreaterThan(0);
  });

  // 정상적인 핏·비율 표현은 통과해야 한다
  it.each([
    "전체 기장·비율을 고려한 제안이 중요해요.",
    "편안한 착용감과 균형 잡힌 비율을 우선한 스타일",
    "밑위·하의 길이 고민을 함께 다뤄요.",
    "단정한 인상과 활용도를 함께 고려한 스타일",
  ])("allows %s", (text) => {
    expect(findUnsafePhrases(text)).toEqual([]);
  });
});

describe("assertSafeLanguage", () => {
  it("throws with the offending phrase so the retry can fix it", () => {
    expect(() => assertSafeLanguage(["다리가 길어 보이게 입고 싶어요."])).toThrow(
      "외모·체형을 평가하는 표현",
    );
  });

  it("passes when every sentence is safe", () => {
    expect(() =>
      assertSafeLanguage(["편안한 착용감이 중요해요.", "개강 행사에 어울리는 인상이 중요해요."]),
    ).not.toThrow();
  });
});
