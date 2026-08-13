import { describe, expect, it } from "vitest";
import { personaForms } from "../../../src/data/personas.js";
import { calculateStyleScores } from "../../../src/domain/scoring.js";
import type { StyleDnaExplanationRequest } from "../../../src/domain/aiContracts.js";
import { createStyleDnaExplanation } from "./style-dna-explanation.js";

function member(memberId: "self" | "A" | "B", personaId: "P1" | "P4" | "P5") {
  const form = personaForms[personaId];
  return {
    memberId,
    form,
    styleScores: calculateStyleScores({
      preferredStyle: form.preferredStyle,
      avoidedStyle: form.avoidedStyle,
      keywords: form.keywords,
      designElements: form.designElements,
      preferredItems: form.preferredItems,
      avoidedElements: form.avoidedElements,
    }),
  };
}

const groupRequest: StyleDnaExplanationRequest = {
  mode: "group",
  priority: "tpo_first",
  members: [member("A", "P4"), member("B", "P5")],
  groupCompatibility: { styleSimilarity: 41, budgetCompatibility: 20, total: 61 },
};

/**
 * 모델은 조합도 수치를 반환하지 않는다. 서버가 규칙 엔진 값으로 채운다.
 * 실제 호출은 매번 새 JSON을 받으므로 테스트도 호출마다 새 객체를 만든다.
 */
const groupResponse = () => ({
  mode: "group",
  groupStyleDnaSummary: "자연스러운 A와 단정한 B를 함께 살린 스타일",
  groupStyleDnaSummaryEvidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
  groupCombination: {
    title: "각자의 무드를 살린 연결",
    description: "같은 스타일로 맞추기보다 두 사람의 분위기를 유지하는 방향이 좋아요.",
    evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
  },
  groupMatchingPoints: [
    { text: "A와 B의 핏 고민을 각각 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
    { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
  ],
});

describe("createStyleDnaExplanation", () => {
  it("prefixes the system-owned score wording and keeps the AI coordination guidance", async () => {
    const result = await createStyleDnaExplanation(groupRequest, async () => groupResponse());

    expect(result.mode).toBe("group");
    if (result.mode === "group") {
      expect(result.groupCombination.description).toBe(
        "스타일 방향 유사도 41/70 · 예산 조율 가능성 20/30. 같은 스타일로 맞추기보다 두 사람의 분위기를 유지하는 방향이 좋아요.",
      );
    }
  });

  it("fills the combination scores from the rule engine instead of the model", async () => {
    const result = await createStyleDnaExplanation(groupRequest, async () => groupResponse());

    if (result.mode !== "group") throw new Error("expected a group result");
    expect(result.groupCombination.score).toBe(61);
    expect(result.groupCombination.directionSimilarity).toBe(41);
    expect(result.groupCombination.budgetCoordination).toBe(20);
  });

  it("rejects a combination title outside 8-24 characters", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupCombination: { ...groupResponse().groupCombination, title: "짧은제목" },
    }))).rejects.toThrow("title must be 8-24 characters");
  });

  it("rejects a group combination description that writes its own score numbers", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupCombination: {
        ...groupResponse().groupCombination,
        description: "스타일 방향 유사도 55/70이라 잘 맞아요.",
      },
    }))).rejects.toThrow("수치 없이 조율 방향만");
  });

  it("drops unknown evidence refs but keeps the sentence when a valid one remains", async () => {
    const result = await createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupMatchingPoints: [
        {
          text: "A와 B의 핏 고민을 각각 고려해요.",
          evidenceRefs: ["A.fitConcerns.0", "made.up.ref", "B.fitConcerns.0"],
        },
        { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
      ],
    }));

    if (result.mode !== "group") throw new Error("expected a group result");
    expect(result.groupMatchingPoints[0].evidenceRefs).toEqual([
      "A.fitConcerns.0",
      "B.fitConcerns.0",
    ]);
  });

  it("rejects a sentence whose evidence refs are all outside the input", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupMatchingPoints: [
        { text: "지어낸 근거만 있는 문장이에요.", evidenceRefs: ["made.up.ref"] },
        { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
      ],
    }))).rejects.toThrow("근거가 모두 입력에 없는 값입니다");
  });

  it("rejects a group summary grounded in fit or budget instead of style signals", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupStyleDnaSummaryEvidenceRefs: ["A.fitConcerns.0", "B.budgetRange"],
    }))).rejects.toThrow("그룹 요약의 근거가 모두 입력에 없는 값입니다");
  });

  it("rejects a group summary that leaves out one member", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      ...groupResponse(),
      groupStyleDnaSummaryEvidenceRefs: ["A.preferredStyle", "A.keywords"],
    }))).rejects.toThrow("A와 B의 스타일 신호를 모두");
  });
});
