import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App.js";

describe("BiasFit React flow", () => {
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
  });

  it("sends new visitors from the home screen into the signup role picker", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /내 취향은 그대로, 오늘의 코디는 더 쉽게/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(
      await screen.findByRole("heading", {
        name: /어떤 역할로\s*시작할까요/,
      }),
    ).toBeInTheDocument();
  });

  it("moves from the reference home screen into the user coaching flow", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "이미 계정이 있어요" }));
    expect(
      await screen.findByRole("heading", {
        name: /나의 스타일 기준을 시작해요/,
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
    // 홈(A1)에는 "로그인" 링크만 있고, 인플루언서 로그인으로 갈아타는 링크는
    // 사용자 로그인 화면의 공용 상단 내비게이션에 있다.
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "인플루언서 로그인" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /배정된 요청을 확인하고\s*코디 카드를 전달하세요/,
      }),
    ).toBeInTheDocument();
  });

  it("creates a user account and continues to coaching selection", async () => {
    render(<App />);

    // "시작하기"는 곧바로 회원가입 유형 선택(A2)으로 간다.
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    fireEvent.click(
      await screen.findByRole("radio", { name: /사용자로 시작하기/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));

    expect(
      screen.queryByRole("button", { name: "05 / 05" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/테스트 이메일/), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText(/닉네임/), {
      target: { value: "새 사용자" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호 필수$/), {
      target: { value: "biasfit01" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
      target: { value: "biasfit01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "가입하고 시작하기" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /어떤 스타일링을 원하나요/,
      }),
    ).toBeInTheDocument();
  });

  it("creates an influencer account and continues to profile setup", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "인플루언서 로그인" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "처음이신가요? 회원가입",
      }),
    );

    fireEvent.click(
      await screen.findByRole("radio", { name: /인플루언서로 시작하기/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));

    fireEvent.change(screen.getByLabelText(/테스트 이메일/), {
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
      screen.getByRole("button", { name: "가입하고 프로필 만들기" }),
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

    fireEvent.change(screen.getByLabelText(/테스트 이메일/), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByLabelText(/닉네임/), {
      target: { value: "새 사용자" },
    });
    fireEvent.change(screen.getByLabelText(/^비밀번호 필수$/), {
      target: { value: "biasfit01" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인/), {
      target: { value: "different" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "가입하고 시작하기" }),
    );

    expect(
      screen.getByText("비밀번호가 일치하지 않아요."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /사용자 계정을/ }),
    ).toBeInTheDocument();
  });
});
