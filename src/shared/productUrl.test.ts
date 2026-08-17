import { describe, expect, it } from "vitest";
import { productUrlLabel } from "./productUrl.js";

describe("productUrlLabel", () => {
  it("긴 상품 주소를 도메인만 남긴다", () => {
    expect(
      productUrlLabel("https://arielstyle.co.kr/product/%ED%95%9C%EA%B8%80/12345/category/50/"),
    ).toBe("arielstyle.co.kr");
  });

  it("www. 접두사는 뗀다", () => {
    expect(productUrlLabel("https://www.musinsa.com/app/goods/1234567")).toBe("musinsa.com");
  });

  it("주소 형식이 아니면 원본을 그대로 보여준다", () => {
    // 파싱 실패를 빈 값으로 삼키면 어디로 가는 링크인지 알 수 없게 된다.
    expect(productUrlLabel("arielstyle.co.kr/product/1")).toBe("arielstyle.co.kr/product/1");
    expect(productUrlLabel("  ")).toBe("");
  });
});
