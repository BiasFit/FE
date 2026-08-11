import { describe, expect, it } from "vitest";
import type { MatchExplanationsRequest } from "../../src/domain/aiContracts";
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

describe("createMatchExplanations", () => {
  it("accepts explanations grounded in the fixed candidate evidence", async () => {
    const result = await createMatchExplanations(request, async () => ({
      explanations: [
        {
          influencerId: "stylemate-01",
          strongestCategory: "fit",
          summary: "두 구성원의 핏 고민을 함께 다룰 수 있어 추천했어요.",
          evidenceRefs: ["A.fit.concern.0", "B.fit.concern.0"],
        },
      ],
    }));

    expect(result.explanations[0].influencerId).toBe("stylemate-01");
  });

  it("rejects a candidate or evidence invented by OpenAI", async () => {
    await expect(
      createMatchExplanations(request, async () => ({
        explanations: [
          {
            influencerId: "not-in-top-three",
            strongestCategory: "fit",
            summary: "근거 없는 추천",
            evidenceRefs: ["invented.evidence"],
          },
        ],
      })),
    ).rejects.toThrow("fixed TOP 3");
  });

  it("rejects an explanation that changes the calculated strongest category", async () => {
    await expect(
      createMatchExplanations(request, async () => ({
        explanations: [
          {
            influencerId: "stylemate-01",
            strongestCategory: "style",
            summary: "계산 결과와 다른 항목을 가장 강한 이유로 설명해요.",
            evidenceRefs: ["A.style.0", "B.style.0"],
          },
        ],
      })),
    ).rejects.toThrow("strongest match category");
  });
});
