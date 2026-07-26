import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("BiasFit React flow", () => {
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
  });

  it("moves from the reference home screen into the user coaching flow", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /나에게 맞는 스타일 기준을 찾아요/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Style DNA 시작하기/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /나의 Style DNA를 시작해 볼까요/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /P1 더미 계정으로 시작하기/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /어떤 코칭을 받을까요/,
      }),
    ).toBeInTheDocument();
  });

  it("opens the influencer workspace from the shared navigation", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "인플루언서 로그인" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /배정된 요청을 확인하고 코디 카드를 전달하세요/,
      }),
    ).toBeInTheDocument();
  });
});
