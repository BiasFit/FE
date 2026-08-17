import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";

/**
 * 경계가 없으면 렌더 오류 하나에 트리가 통째로 사라져 화면이 하얗게 된다
 * (`MEMO/KPI_조회_가이드.md`가 치명 증상으로 꼽는 상태). 그 자리를 지키는 테스트다.
 */
function Boom(): JSX.Element {
  throw new Error("검증용 렌더 오류");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React가 잡힌 오류를 콘솔에 다시 뱉는다. 테스트 출력만 조용히 한다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("정상일 때는 자식을 그대로 보여준다", () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("정상 화면")).toBeVisible();
  });

  it("렌더 오류가 나면 빈 화면 대신 안내와 돌아갈 길을 보여준다", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("화면을 표시하지 못했어요.")).toBeVisible();
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /처음부터 다시 시작/ }),
    ).toBeVisible();
  });

  it("오류 원문을 삼키지 않고 콘솔에 남긴다", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(
      logged.some((call) => String(call[0]).includes("[BiasFit 화면] 렌더 중 오류")),
    ).toBe(true);
  });
});
