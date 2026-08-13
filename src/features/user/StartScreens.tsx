import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../app/AppStateProvider.js";
import { useAuth } from "../../app/AuthProvider.js";

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <section className="screen home-screen is-active">
      <div className="home-wrap">
        <div className="home-copy">
          <h1>
            내 취향은 그대로,
            <br />
            오늘의 코디는 더 쉽게.
          </h1>
          {/* 홈에서는 내부 용어(Style DNA·스타일메이트)를 쓰지 않는다. 처음 온 사람이 읽는 첫 문장이다. */}
          <p>
            체형·취향·예산·TPO를 바탕으로 나와 비슷한 패션 인플루언서의 코디
            추천을 받아보세요.
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
        {/* 아래 문구는 제목과 같은 말이라 삭제했다 (문구 피드백 2026-08-14). */}
        <div className="home-visual" aria-label="BiasFit 캠퍼스 스타일 이미지">
          <div className="photo-tile one" />
          <div className="photo-tile two" />
          <div className="photo-tile three" />
        </div>
      </div>
    </section>
  );
}

export function UserLoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginId, setLoginId] = useState("p1");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const login = () => {
    setLoggingIn(true);
    setLoginError("");
    void signIn({ loginId, password })
      .then((account) => {
        // 인플루언서 계정으로 사용자 흐름에 들어오는 것을 여기서도 막는다.
        navigate(account.role === "influencer" ? "/influencer/requests" : "/user/coaching");
      })
      .catch((error: unknown) => {
        setLoginError(error instanceof Error ? error.message : "로그인하지 못했어요.");
        setLoggingIn(false);
      });
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
              Style DNA 진단 받기
            </h1>
            <p className="page-desc">
              BiasFit과 함께, ‘나만의 스타일’을 찾아봐요.
              <br />
              사전에 안내드린 개인 테스트 계정으로 로그인해 주세요.
            </p>
          </div>
          <div className="work-body">
            <div className="login-card">
              <label className="field">
                <span className="field-label">테스트 아이디</span>
                <input
                  className="text-input"
                  type="text"
                  autoComplete="username"
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">테스트 코드</span>
                <input
                  className="text-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p className="helper">
                실제 이메일이나 비밀번호는 입력하지 마세요.
              </p>
              {loginError ? (
                <p className="error-copy" style={{ display: "block" }} aria-live="polite">
                  {loginError}
                </p>
              ) : null}
              <button
                className="btn-primary"
                type="button"
                disabled={loggingIn || !loginId.trim() || !password}
                onClick={login}
              >
                {loggingIn ? "로그인하는 중이에요." : "로그인"}
              </button>
              <div className="divider">또는</div>
              <button
                className="btn-secondary"
                type="button"
                disabled={loggingIn}
                onClick={() => {
                  // 인증 설정 전에는 네트워크 없이 통과하고, 설정 뒤에는 실제 p1 계정으로 로그인한다.
                  setLoginId("p1");
                  setLoggingIn(true);
                  setLoginError("");
                  void signIn({ loginId: "p1", password: password || "biasfit01" })
                    .then(() => navigate("/user/coaching"))
                    .catch((error: unknown) => {
                      setLoginError(
                        error instanceof Error ? error.message : "로그인하지 못했어요.",
                      );
                      setLoggingIn(false);
                    });
                }}
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
          <h2>스타일링의 기준을 정해요.</h2>
          <p>혼자 또는 두 사람이 함께 사용할 스타일 기준을 선택합니다.</p>
        </aside>
        <div className="work-panel">
          <div className="work-head">
            <h1 className="page-title">어떤 스타일링을 원하나요?</h1>
            <p className="page-desc">
              나에게 어울리는 코디를 찾는다면 ‘개인 스타일링’을, 친구·가족 등 두
              사람이 함께 어울리는 코디를 찾는다면 ‘2인 그룹 스타일링’을 선택해
              주세요.
            </p>
          </div>
          <div className="work-body">
            <div className="card-grid" role="radiogroup" aria-label="스타일링 유형">
              {[
                {
                  mode: "personal" as const,
                  title: "개인 스타일링(코디)",
                  // 초기 화면에서는 '스타일메이트' 대신 '패션 인플루언서'로 안내한다.
                  copy: "내 체형, 취향, 예산, TPO를 기준으로 나와 딱 맞는 패션 인플루언서를 연결해줘요.",
                },
                {
                  mode: "group" as const,
                  title: "2인 그룹 스타일링(코디)",
                  copy: "각자의 취향을 존중하면서도, 친구·가족 등 소중한 사람과 함께 입고 싶은 시밀러룩 스타일링을 요청할 수 있어요.",
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
