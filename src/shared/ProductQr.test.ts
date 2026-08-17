import { describe, expect, it } from "vitest";
import { qrPayload } from "./ProductQr.js";

describe("qrPayload", () => {
  it("한글이 인코딩된 주소는 풀어서 담는다", () => {
    // 241자 → 89자로 줄어 QR 칸이 커진다. 열리는 주소는 같다.
    const encoded =
      "https://www.arielstyle.co.kr/product/%ED%95%80%ED%84%B1%EC%99%80%EC%9D%B4%EB%93%9C/25270/category/205/display/1/";
    expect(qrPayload(encoded)).toBe(
      "https://www.arielstyle.co.kr/product/핀턱와이드/25270/category/205/display/1/",
    );
  });

  it("풀면 다른 주소가 되는 인코딩은 그대로 둔다", () => {
    // %2F를 풀면 경로 구분자가 되어 다른 주소가 된다.
    const tricky = "https://a.com/p/%2Fslash%2F/1";
    expect(qrPayload(tricky)).toBe(tricky);
  });

  it("인코딩이 깨진 주소도 그대로 담는다", () => {
    expect(qrPayload("https://a.com/%zz")).toBe("https://a.com/%zz");
  });

  it("풀 것이 없는 주소는 그대로다", () => {
    expect(qrPayload("https://musinsa.com/app/goods/1234567")).toBe(
      "https://musinsa.com/app/goods/1234567",
    );
  });
});
