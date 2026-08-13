import { describe, expect, it } from "vitest";
import {
  isValidOutfitDraft,
  isValidProductUrl,
  toOutfitReviewRequest,
} from "./outfit";

describe("outfit product validation", () => {
  it("accepts only complete products with http or https links", () => {
    expect(isValidProductUrl("https://shop.test/top/1")).toBe(true);
    expect(isValidProductUrl("http://shop.test/bottom/2")).toBe(true);
    expect(isValidProductUrl("shop.test/top/1")).toBe(false);
    expect(isValidProductUrl("javascript:alert(1)")).toBe(false);

    expect(
      isValidOutfitDraft({
        title: "부드러운 캠퍼스 레이어드",
        top: { name: "가디건", url: "https://shop.test/top/1" },
        bottom: { name: "스커트", url: "https://shop.test/bottom/2" },
        message: "코디 설명",
      }),
    ).toBe(true);
    expect(
      isValidOutfitDraft({
        title: "부드러운 캠퍼스 레이어드",
        top: { name: "가디건", url: "잘못된 링크" },
        bottom: { name: "스커트", url: "https://shop.test/bottom/2" },
        message: "코디 설명",
      }),
    ).toBe(false);
  });

  it("제목이나 전하는 말이 비면 전달할 수 없다", () => {
    const complete = {
      title: "부드러운 캠퍼스 레이어드",
      top: { name: "가디건", url: "https://shop.test/top/1" },
      bottom: { name: "스커트", url: "https://shop.test/bottom/2" },
      message: "코디 설명",
    };

    expect(isValidOutfitDraft({ ...complete, title: "  " })).toBe(false);
    expect(isValidOutfitDraft({ ...complete, message: "" })).toBe(false);
  });
});

describe("outfit review request", () => {
  it("preserves both group members and only top/bottom products", () => {
    const result = toOutfitReviewRequest({
      memberA: {
        top: { name: "A 상의", url: "https://shop.test/a-top" },
        bottom: { name: "A 하의", url: "https://shop.test/a-bottom" },
      },
      memberB: {
        top: { name: "B 상의", url: "https://shop.test/b-top" },
        bottom: { name: "B 하의", url: "https://shop.test/b-bottom" },
      },
      title: "함께 어울리는 여행룩",
      message: "각자의 취향을 유지한 코디예요.",
    });

    expect(result.mode).toBe("group");
    expect(result.cards.map(({ memberId }) => memberId)).toEqual(["A", "B"]);
    expect(result.cards[0]).toEqual({
      memberId: "A",
      top: { name: "A 상의", url: "https://shop.test/a-top" },
      bottom: { name: "A 하의", url: "https://shop.test/a-bottom" },
    });
  });
});
