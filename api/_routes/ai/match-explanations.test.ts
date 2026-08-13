import { describe, expect, it, vi } from "vitest";
import type { MatchExplanationsRequest } from "../../../src/domain/aiContracts";
import { createMatchExplanations } from "./match-explanations";

const request: MatchExplanationsRequest = {
  mode: "group",
  priority: "fit_first",
  rankedInfluencers: [
    {
      influencerId: "stylemate-01",
      rank: 1,
      matchScore: 91,
      breakdown: {
        style: 20,
        fit: 28,
        budget: 14,
        tpo: 20,
        rawTotal: 82,
        matchScore: 91,
      },
      matchedEvidence: {
        style: [
          { ref: "A.style.0", text: "캐주얼" },
          { ref: "B.style.0", text: "오피스" },
        ],
        fit: [
          { ref: "A.fit.concern.0", text: "전체 기장·비율" },
          { ref: "B.fit.concern.0", text: "가슴·상체 여유" },
        ],
        budget: [],
        tpo: [{ ref: "A.tpo", text: "여행·사진" }],
      },
    },
  ],
};

const validExplanation = {
  influencerId: "stylemate-01",
  summary: "두 구성원의 핏 고민을 함께 다룰 수 있어 추천했어요.",
  evidenceRefs: ["A.fit.concern.0", "B.fit.concern.0"],
};

describe("createMatchExplanations", () => {
  it("accepts explanations grounded in the fixed candidate evidence", async () => {
    const result = await createMatchExplanations(request, async () => ({
      explanations: [validExplanation],
    }));

    expect(result.explanations[0].influencerId).toBe("stylemate-01");
  });

  it("fills the strongest category from the rule engine, not the model", async () => {
    const result = await createMatchExplanations(request, async () => ({
      // 모델이 계산값과 다른 항목을 보내도 규칙 엔진 값으로 덮어쓴다.
      explanations: [{ ...validExplanation, strongestCategory: "style" }],
    }));

    expect(result.explanations[0].strongestCategory).toBe("fit");
  });

  it("breaks a tie with the fixed style > fit > budget > tpo order", async () => {
    const tied: MatchExplanationsRequest = {
      ...request,
      rankedInfluencers: [
        {
          ...request.rankedInfluencers[0],
          breakdown: {
            style: 28,
            fit: 28,
            budget: 14,
            tpo: 20,
            rawTotal: 90,
            matchScore: 91,
          },
        },
      ],
    };

    const result = await createMatchExplanations(tied, async () => ({
      explanations: [validExplanation],
    }));

    expect(result.explanations[0].strongestCategory).toBe("style");
  });

  it("rejects a candidate or evidence invented by OpenAI", async () => {
    await expect(
      createMatchExplanations(request, async () => ({
        explanations: [
          {
            influencerId: "not-in-top-three",
            summary: "근거 없는 추천",
            evidenceRefs: ["invented.evidence"],
          },
        ],
      })),
    ).rejects.toThrow("fixed TOP 3");
  });

  it("rejects evidence outside the calculated match result", async () => {
    await expect(
      createMatchExplanations(request, async () => ({
        explanations: [{ ...validExplanation, evidenceRefs: ["A.budget.range"] }],
      })),
    ).rejects.toThrow("evidence outside the calculated match result");
  });

  it("retries with the rejection reason and accepts a repaired response", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        explanations: [{ ...validExplanation, evidenceRefs: ["A.fit.concern.0"] }],
      })
      .mockResolvedValueOnce({ explanations: [validExplanation] });

    const result = await createMatchExplanations(request, generate);

    expect(result.explanations[0].summary).toBe(validExplanation.summary);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][0].repairNote).toBeUndefined();
    expect(generate.mock.calls[1][0].repairNote).toContain("A and B");
  });
});
