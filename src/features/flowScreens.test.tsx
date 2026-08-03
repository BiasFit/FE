import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("user feature screens", () => {
  beforeEach(() => localStorage.clear());

  it("renders the body and fit input with the P1 defaults", async () => {
    window.location.hash = "#/user/body";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /옷을 고를 때 고민되는 핏을 알려주세요/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "키" })).toHaveValue(158);
  });

  it("renders a calculated Style DNA instead of fixed display-only data", async () => {
    window.location.hash = "#/user/dna";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /부드럽고 단정한 캠퍼스 밸런스/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("75", { selector: ".score-value" })).toBeVisible();
  });

  it("renders three ranked stylemates with matching reasons", async () => {
    window.location.hash = "#/user/top3";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /나와 잘 맞는 스타일메이트를 비교해 보세요/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains("reason-bar") === true &&
          element.textContent?.startsWith("스타일 취향 19/30") === true,
      ),
    ).toBeVisible();
  });

  it("blocks progress when an exact-three style signal becomes incomplete", async () => {
    window.location.hash = "#/user/signals";
    render(<App />);

    const selectedKeyword = await screen.findByRole("button", {
      name: "부드러운",
    });
    fireEvent.click(selectedKeyword);

    expect(
      screen.getByRole("button", { name: /예산 입력하기/ }),
    ).toBeDisabled();
  });

  it("renders the request and outfit result screens", async () => {
    window.location.hash = "#/user/request";
    const { unmount } = render(<App />);
    const request = await screen.findByRole("textbox", {
      name: /부탁해요 카드/,
    });
    expect((request as HTMLTextAreaElement).value).toContain("개강 첫 주");
    unmount();

    window.location.hash = "#/user/outfit";
    render(<App />);
    expect(
      await screen.findByRole("button", { name: /이미지로 저장하기/ }),
    ).toBeVisible();
  });
});

describe("influencer feature screens", () => {
  it("shows only the assigned request list", async () => {
    window.location.hash = "#/influencer/requests";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "내 배정 요청" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /요청/ })).toHaveLength(3);
  });

  it("shows Style DNA, request context and outfit fields on one page", async () => {
    window.location.hash = "#/influencer/detail";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "코디 카드 작성" }),
    ).toBeInTheDocument();
    expect(screen.getByText("스타일 진단 결과")).toBeVisible();
    expect(screen.getByText("부탁해요 카드")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "상의 제품명" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "상의 상품 링크" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "신발" })).not.toBeInTheDocument();
    expect(screen.getByText(/요청 예산/)).toBeVisible();
    const deliver = screen.getByRole("button", { name: /전달하기/ });
    expect(deliver).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: "상의 상품 링크" }), {
      target: { value: "잘못된 링크" },
    });
    expect(deliver).toBeDisabled();
  });
});
