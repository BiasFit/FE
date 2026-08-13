import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App.js";

describe("BiasFit React flow", () => {
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
  });

  it("moves from the reference home screen into the user coaching flow", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /내 취향은 그대로, 오늘의 코디는 더 쉽게/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /내 스타일 진단 시작하기/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /Style DNA 진단 받기/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /P1 더미 계정으로 시작하기/ }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /어떤 스타일링을 원하나요/,
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
        name: /사전에 안내된 개인 테스트 계정으로 로그인해 주세요/,
      }),
    ).toBeInTheDocument();
  });

  it("creates a user account and continues to coaching selection", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /내 스타일 진단 시작하기/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "처음이신가요? 회원가입",
      }),
    );

    fireEvent.click(
      await screen.findByRole("radio", { name: /일반 사용자/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));

    expect(
      screen.queryByRole("button", { name: "05 / 05" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/로그인 아이디/), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText(/표시 이름/), {
      target: { value: "새 사용자" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호 필수$/), {
      target: { value: "biasfit01" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
      target: { value: "biasfit01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "사용자로 가입하기" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /어떤 스타일링을 원하나요/,
      }),
    ).toBeInTheDocument();
  });

  it("creates an influencer account and continues to profile setup", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "인플루언서 로그인" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "처음이신가요? 회원가입",
      }),
    );

    fireEvent.click(
      await screen.findByRole("radio", { name: /인플루언서/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));

    fireEvent.change(screen.getByLabelText(/로그인 아이디/), {
      target: { value: "new-stylemate" },
    });
    fireEvent.change(screen.getByLabelText(/활동명/), {
      target: { value: "STYLEMATE NEW" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호 필수$/), {
      target: { value: "mate0101" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
      target: { value: "mate0101" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "인플루언서로 가입하기" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /사용자와의 매칭에 활용될 스타일링 정보를 입력해 주세요/,
      }),
    ).toBeInTheDocument();
  });

  it("keeps the signup form open when passwords do not match", async () => {
    window.location.hash = "#/user/signup";
    render(<App />);

    fireEvent.change(screen.getByLabelText(/로그인 아이디/), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText(/표시 이름/), {
      target: { value: "새 사용자" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호 필수$/), {
      target: { value: "biasfit01" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
      target: { value: "different" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "사용자로 가입하기" }),
    );

    expect(
      screen.getByText("비밀번호가 일치하지 않아요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /사용자 계정을 만들어요/ }),
    ).toBeInTheDocument();
  });
});
