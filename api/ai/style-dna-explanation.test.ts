import { describe, expect, it } from "vitest";
import { personaForms } from "../../src/data/personas";
import { calculateStyleScores } from "../../src/domain/scoring";
import type { StyleDnaExplanationRequest } from "../../src/domain/aiContracts";
import { createStyleDnaExplanation } from "./style-dna-explanation";

function member(memberId: "personal" | "A" | "B", personaId: "P1" | "P4" | "P5") {
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

describe("createStyleDnaExplanation", () => {
  it("prefixes the system-owned score wording and keeps the AI coordination guidance", async () => {
    const result = await createStyleDnaExplanation(groupRequest, async () => ({
      mode: "group",
      groupStyleDnaSummary: "자연스러운 A와 단정한 B를 함께 살린 스타일",
      groupStyleDnaSummaryEvidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
      groupCombination: {
        score: 61,
        directionSimilarity: 41,
        budgetCoordination: 20,
        title: "각자의 무드를 살린 연결",
        description: "같은 스타일로 맞추기보다 두 사람의 분위기를 유지하는 방향이 좋아요.",
        evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
      },
      groupMatchingPoints: [
        { text: "A와 B의 핏 고민을 각각 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
        { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
      ],
    }));

    expect(result.mode).toBe("group");
    if (result.mode === "group") {
      expect(result.groupCombination.description).toBe(
        "스타일 방향 유사도 41/70 · 예산 조율 가능성 20/30. 같은 스타일로 맞추기보다 두 사람의 분위기를 유지하는 방향이 좋아요.",
      );
    }
  });

  it("rejects a group combination description that writes its own score numbers", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      mode: "group",
      groupStyleDnaSummary: "자연스러운 A와 단정한 B를 함께 살린 스타일",
      groupStyleDnaSummaryEvidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
      groupCombination: {
        score: 61, directionSimilarity: 41, budgetCoordination: 20,
        title: "각자의 무드를 살린 연결",
        description: "스타일 방향 유사도 55/70이라 잘 맞아요.",
        evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
      },
      groupMatchingPoints: [
        { text: "A와 B의 핏 고민을 각각 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
        { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
      ],
    }))).rejects.toThrow("수치 없이 조율 방향만");
  });

  it("rejects a group summary that omits a member or uses fit and budget as its basis", async () => {
    await expect(createStyleDnaExplanation(groupRequest, async () => ({
      mode: "group",
      groupStyleDnaSummary: "자연스러운 A의 무드만 중심으로 살린 여행 스타일",
      groupStyleDnaSummaryEvidenceRefs: ["A.fitConcerns.0"],
      groupCombination: {
        score: 61, directionSimilarity: 41, budgetCoordination: 20,
        title: "각자의 무드를 살린 연결", description: "임시 설명",
        evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
      },
      groupMatchingPoints: [
        { text: "A의 고민을 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
        { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
      ],
    }))).rejects.toThrow("A/B 스타일 신호");
  });
});
