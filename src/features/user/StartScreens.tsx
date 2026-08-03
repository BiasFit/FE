import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../app/AppStateProvider";

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <section className="screen home-screen is-active">
      <div className="home-wrap">
        <div className="home-copy">
          <h1>
            내 취향과 핏에 맞는
            <br />
            코디를 받아보세요.
          </h1>
          <p>
            핏 고민, 취향, 예산, 입을 상황을 알려주면 나에게 맞는
            스타일메이트가 코디를 제안해요.
          </p>
          <div className="home-actions">
            <button
              className="btn-primary"
              type="button"
              onClick={() => navigate("/user/login")}
            >
              내 스타일 진단 시작하기 <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="home-note">
            <span aria-hidden="true">♢</span> 실제 개인정보 없이 팀이 만든 더미
            데이터로 체험합니다.
          </p>
        </div>
        <div className="home-visual" aria-label="BiasFit 캠퍼스 스타일 이미지">
          <div className="photo-tile one" />
          <div className="photo-tile two" />
          <div className="photo-tile three" />
          <div className="visual-note">
            내 취향은 그대로,
            <br />
            오늘의 선택은 더 쉬워지게.
          </div>
        </div>
      </div>
    </section>
  );
}

export function UserLoginScreen() {
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);
  const login = () => {
    setLoggingIn(true);
    window.setTimeout(() => navigate("/user/coaching"), 650);
  };
  return (
    <section className="screen is-active">
      <div className="service-layout">
        <aside className="context-panel">
          <p className="context-brand">BiasFit</p>
          <p className="context-step">USER FLOW · 01 / 05</p>
          <h2>나의 스타일 기준을 시작해요.</h2>
          <p>실제 개인정보 없이 테스트 계정으로 안전하게 시작합니다.</p>
        </aside>
        <div className="work-panel">
          <div className="work-head">
            <p className="eyebrow">USER START</p>
            <h1 className="page-title">
              먼저 스타일 진단을
              <br />
              시작할게요.
            </h1>
            <p className="page-desc">
              테스트 계정으로 로그인하고 개인 또는 그룹 코칭을 선택할 수
              있어요.
            </p>
          </div>
          <div className="work-body">
            <div className="login-card">
              <label className="field">
                <span className="field-label">테스트 이메일</span>
                <input
                  className="text-input"
                  type="email"
                  defaultValue="p1@biasfit.test"
                />
              </label>
              <label className="field">
                <span className="field-label">테스트 코드</span>
                <input
                  className="text-input"
                  type="password"
                  defaultValue="biasfit01"
                />
              </label>
              <p className="helper">
                실제 이메일이나 비밀번호는 입력하지 마세요.
              </p>
              <button
                className="btn-primary"
                type="button"
                disabled={loggingIn}
                onClick={login}
              >
                {loggingIn ? "로그인하는 중이에요." : "로그인"}
              </button>
              <div className="divider">또는</div>
              <button
                className="btn-secondary"
                type="button"
                disabled={loggingIn}
                onClick={login}
              >
                P1 더미 계정으로 시작하기
              </button>
              <button
                className="btn-ghost signup-login-link"
                type="button"
                disabled={loggingIn}
                onClick={() => navigate("/signup")}
              >
                처음이신가요? 회원가입
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CoachingScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();

  return (
    <section className="screen is-active">
      <div className="service-layout">
        <aside className="context-panel">
          <p className="context-brand">BiasFit</p>
          <p className="context-step">USER FLOW · 01 / 05</p>
          <h2>코칭의 기준을 정해요.</h2>
          <p>혼자 또는 두 사람이 함께 사용할 스타일 기준을 선택합니다.</p>
        </aside>
        <div className="work-panel">
          <div className="work-head">
            <h1 className="page-title">어떤 코디가 필요하세요?</h1>
            <p className="page-desc">
              혼자만의 기준을 찾거나, 두 사람의 취향을 함께 살릴 수 있어요.
            </p>
          </div>
          <div className="work-body">
            <div className="card-grid" role="radiogroup" aria-label="코칭 유형">
              {[
                {
                  mode: "personal" as const,
                  title: "나만의 코디",
                  copy: "내 핏 고민과 취향에 맞는 코디를 받아요.",
                },
                {
                  mode: "group" as const,
                  title: "둘이 함께 입는 코디",
                  copy: "각자의 취향은 살리고, 함께 보일 때 조화로운 코디를 받아요.",
                },
              ].map((option) => (
                <button
                  key={option.mode}
                  className={`option-card ${state.mode === option.mode ? "selected" : ""}`}
                  type="button"
                  role="radio"
                  aria-checked={state.mode === option.mode}
                  onClick={() =>
                    dispatch({ type: "setMode", mode: option.mode })
                  }
                >
                  <strong>{option.title}</strong>
                  <p>{option.copy}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="work-actions">
            <button
              className="btn-ghost"
              type="button"
              onClick={() => navigate("/user/login")}
            >
              이전
            </button>
            <button
              className="btn-primary"
              type="button"
              onClick={() => navigate("/user/body")}
            >
              다음 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
