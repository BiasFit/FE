import { describe, expect, it } from "vitest";
import { personaForms } from "../../src/data/personas";
import type { PriorityOptionsRequest } from "../../src/domain/aiContracts";
import { createPriorityOptions } from "./priority-options";

const groupRequest: PriorityOptionsRequest = {
  mode: "group",
  personal: personaForms.P1,
  group: {
    relationship: "friend",
    relationshipOther: "",
    tpo: "여행",
    members: { A: personaForms.P4, B: personaForms.P5 },
  },
};

describe("createPriorityOptions", () => {
  it("normalizes unprefixed personal evidence refs before validating them", async () => {
    const request: PriorityOptionsRequest = { ...groupRequest, mode: "personal" };
    const result = await createPriorityOptions(request, async () => ({
      question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
      options: [
        { code: "style_first", label: "스타일", evidenceRefs: ["preferredStyle"] },
        { code: "fit_first", label: "핏", evidenceRefs: ["fitConcerns"] },
        { code: "budget_first", label: "예산", evidenceRefs: ["budgetRange"] },
        { code: "tpo_first", label: "TPO", evidenceRefs: ["tpo"] },
      ],
    }));

    expect(result.options.flatMap((option) => option.evidenceRefs)).toEqual([
      "personal.preferredStyle",
      "personal.fitConcerns",
      "personal.budgetRange",
      "personal.tpo",
    ]);
  });

  it("accepts the fixed four codes only when group evidence covers A and B", async () => {
    const result = await createPriorityOptions(groupRequest, async () => ({
      question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
      options: [
        { code: "style_first", label: "A와 B의 선호 무드를 함께 지키고 싶어요.", evidenceRefs: ["A.preferredStyle", "B.preferredStyle"] },
        { code: "fit_first", label: "각자의 핏 고민을 우선하고 싶어요.", evidenceRefs: ["A.fitConcerns", "B.fitConcerns"] },
        { code: "budget_first", label: "두 사람의 예산을 먼저 맞추고 싶어요.", evidenceRefs: ["A.budgetRange", "B.budgetRange"] },
        { code: "tpo_first", label: "여행 상황에 가장 어울리게 입고 싶어요.", evidenceRefs: ["group.tpo"] },
      ],
    }));

    expect(result.options).toHaveLength(4);
  });

  it("rejects invented evidence fields and one-member group options", async () => {
    await expect(createPriorityOptions(groupRequest, async () => ({
      question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
      options: [
        { code: "style_first", label: "스타일", evidenceRefs: ["A.invented"] },
        { code: "fit_first", label: "핏", evidenceRefs: ["A.fitConcerns"] },
        { code: "budget_first", label: "예산", evidenceRefs: ["A.budgetRange"] },
        { code: "tpo_first", label: "TPO", evidenceRefs: ["group.tpo"] },
      ],
    }))).rejects.toThrow("unsupported priority evidence");
  });
});
