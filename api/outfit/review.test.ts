import { describe, expect, it } from "vitest";
import type {
  LinkCheck,
  OutfitReviewRequest,
} from "../../src/domain/aiContracts";
import {
  classifyLinkStatus,
  isBlockedHostname,
  isRetryableLinkStatus,
} from "../_lib/link-checker";
import { reviewOutfitCard } from "./review";

const request: OutfitReviewRequest = {
  mode: "personal",
  coachingMessage: "편안한 실루엣을 선택할 수 있어요.",
  cards: [
    {
      memberId: "personal",
      top: { name: "가디건", url: "https://shop.test/top" },
      bottom: { name: "스커트", url: "https://shop.test/bottom" },
    },
  ],
};

const passingLinks: LinkCheck[] = [
  {
    memberId: "personal",
    itemType: "top",
    inputUrl: "https://shop.test/top",
    finalUrl: "https://shop.test/top",
    status: "pass",
    reason: "접속 가능",
    action: "조치 없음",
  },
  {
    memberId: "personal",
    itemType: "bottom",
    inputUrl: "https://shop.test/bottom",
    finalUrl: "https://shop.test/bottom",
    status: "pass",
    reason: "접속 가능",
    action: "조치 없음",
  },
];

describe("outfit review orchestration", () => {
  it("passes only when language and every product link pass", async () => {
    const result = await reviewOutfitCard(request, {
      reviewLanguage: async () => ({ issues: [] }),
      checkLinks: async () => passingLinks,
    });

    expect(result.reviewStatus).toBe("pass");
  });

  it("blocks delivery for an invalid or missing product URL", async () => {
    const result = await reviewOutfitCard(request, {
      reviewLanguage: async () => ({ issues: [] }),
      checkLinks: async () => [
        { ...passingLinks[0], status: "failed", action: "링크 수정" },
        passingLinks[1],
      ],
    });

    expect(result.reviewStatus).toBe("blocked");
  });

  it("requires a link revision for 404 and 410 pages", async () => {
    const result = await reviewOutfitCard(request, {
      reviewLanguage: async () => ({ issues: [] }),
      checkLinks: async () => [
        { ...passingLinks[0], status: "needs_revision", action: "링크 수정" },
        passingLinks[1],
      ],
    });

    expect(result.reviewStatus).toBe("needs_revision");
  });

  it("sends rate limits and repeated server failures to operations review", async () => {
    const result = await reviewOutfitCard(request, {
      reviewLanguage: async () => ({ issues: [] }),
      checkLinks: async () => [
        { ...passingLinks[0], status: "operations_review", action: "운영진 검토" },
        passingLinks[1],
      ],
    });

    expect(result.reviewStatus).toBe("operations_review");
  });

  it("requires revision when OpenAI finds unsafe language", async () => {
    const result = await reviewOutfitCard(request, {
      reviewLanguage: async () => ({
        issues: [
          {
            field: "coaching_message",
            phrase: "단점을 가려야 해요",
            reason: "신체를 결함으로 표현해요",
            suggestedRewrite: "부담스러운 날에는 여유 있는 실루엣을 선택할 수 있어요",
          },
        ],
      }),
      checkLinks: async () => passingLinks,
    });

    expect(result.reviewStatus).toBe("needs_revision");
  });
});

describe("link checker security", () => {
  it("blocks local and private network hosts", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
    expect(isBlockedHostname("10.0.0.4")).toBe(true);
    expect(isBlockedHostname("192.168.1.10")).toBe(true);
    expect(isBlockedHostname("shop.example.com")).toBe(false);
  });

  it("retries access limits and temporary server errors", () => {
    expect(isRetryableLinkStatus(403)).toBe(true);
    expect(isRetryableLinkStatus(429)).toBe(true);
    expect(isRetryableLinkStatus(503)).toBe(true);
    expect(isRetryableLinkStatus(404)).toBe(false);
    expect(classifyLinkStatus(404)).toBe("needs_revision");
    expect(classifyLinkStatus(410)).toBe("needs_revision");
    expect(classifyLinkStatus(401)).toBe("operations_review");
    expect(classifyLinkStatus(503)).toBe("operations_review");
  });
});
