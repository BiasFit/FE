import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppState } from "../../app/AppStateProvider.js";
import { useAuth } from "../../app/AuthProvider.js";
import { BottomTabBar, TopBar } from "../../shared/AppShell.js";
import iconCheck from "../../assets/mypage/icon-check.svg";
import iconAvatar from "../../assets/mypage/icon-avatar.svg";
import lookVintage from "../../assets/design-elements/fashion_reference_based_looks_3x4/03_빈티지.jpg";
import lookRomantic from "../../assets/design-elements/fashion_reference_based_looks_3x4/04_로맨틱.jpg";
import lookCasual from "../../assets/design-elements/fashion_reference_based_looks_3x4/05_캐주얼.jpg";

const HOME_STEPS = [
  {
    number: 1,
    title: "내 기준 정리하기",
    description: "체형·핏 고민·취향·예산을 5단계로 입력해요.",
  },
  {
    number: 2,
    title: "스타일메이트 만나기",
    description: "Style DNA와 맞는 인플루언서 3명을 추천받아요.",
  },
  {
    number: 3,
    title: "코디 카드 받기",
    description: "제품과 전하는 말이 담긴 카드가 도착해요.",
  },
];

/** 사용자가 준 랜딩 데모(biasfit-landing-demo.html)의 오로라 블롭 배치를 그대로 옮겼다. */
const HOME_AURORA_BLOBS = [
  { size: 460, left: -130, top: -190, color: "124,77,255", opacity: 0.55, delay: "0s" },
  { size: 460, left: 140, top: -230, color: "79,141,255", opacity: 0.42, delay: "-3s" },
  { size: 420, left: -60, top: -70, color: "180,156,255", opacity: 0.42, delay: "-6s" },
  { size: 400, left: 190, top: -20, color: "240,194,255", opacity: 0.4, delay: "-9s" },
  { size: 380, left: -100, top: 60, color: "143,220,255", opacity: 0.26, delay: "-12s" },
];

/**
 * 스크롤로 화면에 들어오면 아래에서 위로 살짝 떠오르며 나타난다 (IntersectionObserver).
 *
 * 이동/회전 효과를 커스텀 CSS 클래스(`transform: translateY(...)`)로 만들었더니, 같은
 * 요소에 이미 있던 Tailwind 변형 유틸(`rotate-6`, `-translate-x-1/2` 등)의 `transform`을
 * 통째로 덮어써서 카드가 회전도 안 되고 가운데 정렬도 깨졌다 (2026-08-16 스크린샷).
 * `transform`은 한 요소에 선언 하나만 붙으므로, 등장 애니메이션도 Tailwind 유틸
 * (`translate-y-*`/`opacity-*`)로 만들어 같은 `class` 안에서 자연스럽게 합쳐지게 했다.
 */
function Reveal({
  children,
  delayClass = "",
  className = "",
  as = "div",
}: {
  children: ReactNode;
  delayClass?: string;
  className?: string;
  /** h1 안(phrasing content만 허용)에 쓸 때는 "span"을 넘긴다. */
  as?: "div" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 구형 브라우저·테스트 환경(jsdom)처럼 IntersectionObserver가 없으면
    // 애니메이션 없이 바로 보여준다 — 콘텐츠가 영영 숨어 있으면 안 된다.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${delayClass} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** A1 · 마케팅 첫 화면 (피그마 `12 · v3 · 추가 화면`, node 135:2 개정판 + 사용자가 준 랜딩 데모 애니메이션). */
export function HomeScreen() {
  const navigate = useNavigate();
  const { status, account } = useAuth();
  const isLoggedInUser = status === "signedIn" && account?.role === "user";

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <div className="relative h-[760px] w-full overflow-hidden">
        <div className="aurora-blobs" aria-hidden="true">
          {HOME_AURORA_BLOBS.map((blob, index) => (
            <span
              key={index}
              className="blob"
              style={{
                width: blob.size,
                height: blob.size,
                left: blob.left,
                top: blob.top,
                background: `radial-gradient(closest-side, rgba(${blob.color},${blob.opacity}), rgba(${blob.color},0))`,
                animationDelay: blob.delay,
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,.45) 52%, #fff 82%)",
          }}
          aria-hidden="true"
        />
        <div className="relative flex min-h-[64px] items-center gap-[9px] px-5">
          <p className="text-[17px] font-semibold tracking-[-0.34px] text-[#0a0a0a]">Fitto</p>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => navigate(isLoggedInUser ? "/user/mypage" : "/user/login")}
            className="inline-flex items-center rounded-full border border-white bg-white/70 px-[14px] py-2 text-[11px] font-semibold text-[#0a0a0a]"
          >
            {isLoggedInUser ? "마이페이지" : "로그인"}
          </button>
        </div>
        <div className="relative flex flex-col px-5 pb-7 pt-[56px]">
          <h1 className="m-0 text-[38px] font-semibold leading-[1.2] tracking-[-1.52px] text-[#0a0a0a]">
            <Reveal as="span" delayClass="delay-75" className="block">
              내 취향은 그대로,
            </Reveal>
            <Reveal as="span" delayClass="delay-150" className="block">
              오늘의 코디는
            </Reveal>
            <Reveal as="span" delayClass="delay-200" className="block font-bold text-[#6b4eff]">
              더 쉽게.
            </Reveal>
          </h1>
          <div className="h-5" />
          <Reveal delayClass="delay-300">
            <p className="text-[16px] leading-[1.58] tracking-[-0.24px] text-[#3c3c43]">
              체형·취향·예산·TPO를 바탕으로
              <br />
              나와 잘 맞는 패션 인플루언서를 연결해요.
            </p>
          </Reveal>
          <div className="h-[38px]" />

          {/* hero-visual: 회전된 사진 카드 2장 + 대표 카드 1장 + 떠 있는 스타일메이트 카드.
              가운데 두 장(main-card·chip)은 `left-1/2 -translate-x-1/2`로 안 잡는다 — 그러면
              `hero-float` 애니메이션이 `transform`을 통째로 덮어써서 가운데 정렬이 깨진다
              (2026-08-16 스크린샷). 원본 데모처럼 고정 px `left`로 가운데를 맞춘다. */}
          <div className="relative h-[392px] w-full" aria-label="Fitto 코디 카드 예시">
            <Reveal
              delayClass="delay-500"
              className="absolute left-[-26px] top-[52px] size-[148px] rotate-6 overflow-hidden rounded-[20px] bg-[#f2f2f5] shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
            >
              <img src={lookVintage} alt="" className="size-full object-cover" />
            </Reveal>
            <Reveal
              delayClass="delay-500"
              className="absolute right-[-26px] top-[29px] size-[148px] -rotate-6 overflow-hidden rounded-[20px] bg-[#f2f2f5] shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
            >
              <img src={lookRomantic} alt="" className="size-full object-cover" />
            </Reveal>
            <Reveal
              delayClass="delay-500"
              className="hero-float absolute left-[88px] top-0 h-[286px] w-[214px] overflow-hidden rounded-[24px] bg-[#f2f2f5] shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
            >
              <img src={lookCasual} alt="" className="size-full object-cover" />
            </Reveal>
            <Reveal
              delayClass="delay-700"
              className="hero-float delayed absolute bottom-0 left-[82px] flex w-[226px] flex-col rounded-[18px] bg-white px-4 py-[14px] shadow-[0_10px_28px_rgba(0,0,0,0.12)]"
            >
              <div className="flex w-full items-center gap-[10px]">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#ededf0]">
                  <img src={iconAvatar} alt="" className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold tracking-[-0.055px] text-[#0a0a0a]">
                    스타일메이트 하린
                  </p>
                  <p className="truncate text-[12px] text-[#8e8e93]">개강 행사 코디</p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-[#0a0a0a] px-[9px] py-[5px] text-[11px] font-semibold tracking-[-0.055px] text-white">
                  92
                </span>
              </div>
            </Reveal>
          </div>

          <div className="h-[34px]" />
          <Reveal>
            <p className="text-[20px] font-bold tracking-[-0.4px] text-[#0a0a0a]">이렇게 진행돼요</p>
          </Reveal>
          <div className="h-5" />
          <Reveal>
            <div className="flex flex-col">
              {HOME_STEPS.map((step, index) => (
                <div
                  key={step.number}
                  className={`flex items-start gap-[14px] py-[18px] ${index > 0 ? "border-t border-[#e8e8ec]" : ""}`}
                >
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[11px] font-semibold tracking-[-0.055px] text-white">
                    {step.number}
                  </span>
                  <div className="flex flex-1 flex-col gap-[6px]">
                    <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">{step.title}</p>
                    <p className="text-[12px] text-[#8e8e93]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="h-10" />

          <Reveal>
            <div className="w-full rounded-[24px] bg-[#0a0a0a] px-6 py-[30px]">
              <p className="m-0 text-[24px] font-bold leading-[1.36] tracking-[-0.72px] text-white">
                채팅 없이,
                <br />
                카드 한 장으로.
              </p>
              <div className="h-3" />
              <p className="text-[12px] text-[#a9a9b2]">부탁해요 카드를 한 번 보내면 코디 카드가 도착해요.</p>
            </div>
          </Reveal>
        </div>
      </div>
      <div className="flex flex-col gap-[10px] px-5 pb-[26px] pt-3">
        <button
          type="button"
          onClick={() => navigate(isLoggedInUser ? "/user/coaching" : "/signup")}
          className="flex min-h-[58px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white"
        >
          시작하기
        </button>
        <button
          type="button"
          onClick={() => navigate("/user/login")}
          className="flex min-h-[44px] w-full items-center justify-center text-[12px] text-[#8e8e93]"
        >
          이미 계정이 있어요
        </button>
      </div>
      {isLoggedInUser ? <BottomTabBar active="home" /> : null}
    </section>
  );
}

export function UserLoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginId, setLoginId] = useState("");
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
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[22px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          나의 스타일 기준을
          <br />
          시작해요.
        </h1>
        <div className="h-[10px]" />
        <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#8e8e93]">
          가입할 때 만든 아이디와 비밀번호로 로그인해 주세요.
        </p>
        <div className="h-[34px]" />

        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">아이디</span>
            <input
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">비밀번호</span>
            <input
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>
        <div className="h-[18px]" />
        {/* 실제 인증 정보를 그대로 쓰지 않게 막는 안내다 (AGENTS.md Guardrails). */}
        <p className="text-[12px] text-[#8e8e93]">다른 곳에서 쓰는 비밀번호는 사용하지 마세요.</p>
        {loginError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]" aria-live="polite">
            {loginError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-[10px] px-5 pb-[26px] pt-[10px]">
        <button
          type="button"
          disabled={loggingIn || !loginId.trim() || !password}
          onClick={login}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-40"
        >
          {loggingIn ? "로그인하는 중이에요." : "로그인"}
        </button>
        <button
          type="button"
          disabled={loggingIn}
          onClick={() => navigate("/signup")}
          className="text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          처음이신가요? 회원가입
        </button>
        {/* 기존 SiteNav(보라 톤 상단바)에 있던 흐름 전환 링크 — 이 화면을 v3로 새로 짜면서
            SiteNav를 숨겼기 때문에, 인플루언서로 갈아타는 길이 사라지지 않게 여기 남겨 둔다. */}
        <button
          type="button"
          disabled={loggingIn}
          onClick={() => navigate("/influencer/login")}
          className="text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          인플루언서 로그인
        </button>
      </div>
    </section>
  );
}

/**
 * U2 · 스타일링 유형 (피그마 `10 · v3 · 사용자 화면`).
 * 로그인한 사용자의 실질적인 "홈"이라, 하단 탭바(홈=이 화면·기록=마이페이지)를 여기서부터 둔다.
 */
export function CoachingScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();

  const options = [
    {
      mode: "personal" as const,
      title: "개인 스타일링",
      copy: "내 체형·취향·예산·TPO를 기준으로 나와 잘 맞는 패션 인플루언서를 연결해요.",
      caption: "체형 · 핏 고민 · 취향 · 예산 · TPO 1개",
    },
    {
      mode: "group" as const,
      title: "2인 그룹 스타일링",
      copy: "각자의 취향은 그대로 살리면서 함께 어울리는 시밀러룩을 받아요.",
      caption: "관계 유형 · 약속 TPO 1개 · 두 사람의 취향",
    },
  ];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/login")} />
      <div className="px-5">
        <div className="h-[3px] w-full rounded-full bg-[#ededef]" />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[22px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          어떤 스타일링을 원하나요?
        </h1>
        <div className="h-[10px]" />
        <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#8e8e93]">
          혼자 입을 코디와 둘이 맞춰 입을 코디는
          <br />
          추천 방식이 달라요.
        </p>
        <div className="h-[30px]" />

        <div className="flex w-full flex-col gap-3" role="radiogroup" aria-label="스타일링 유형">
          {options.map((option) => {
            const selected = state.mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => dispatch({ type: "setMode", mode: option.mode })}
                className={
                  selected
                    ? "w-full rounded-[18px] border-[1.6px] border-[#0a0a0a] bg-white px-5 py-[22px] text-left shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                    : "w-full rounded-[18px] bg-[#f5f5f7] px-5 py-[22px] text-left"
                }
              >
                <div className="flex w-full items-center gap-[10px]">
                  <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">{option.title}</p>
                  <div className="flex-1" />
                  {selected ? <img src={iconCheck} alt="" className="size-[22px]" /> : null}
                </div>
                <div className="h-2" />
                <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#3c3c43]">
                  {option.copy}
                </p>
                <div className="h-[14px]" />
                <p className="text-[13px] font-medium tracking-[-0.195px] text-[#8e8e93]">{option.caption}</p>
              </button>
            );
          })}
        </div>

        <div className="h-5" />
        <p className="text-[13px] font-medium leading-[1.5] tracking-[-0.195px] text-[#8e8e93]">
          두 사람의 취향은 각각 저장돼요.
          <br />
          한 사람의 취향이 다른 사람을 덮어쓰지 않아요.
        </p>
      </div>
      <div className="px-5 pb-[10px] pt-[10px]">
        <button
          type="button"
          onClick={() => navigate("/user/body")}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white"
        >
          다음
        </button>
      </div>
      {/* '홈'을 눌러도 이 화면(U2)으로 돌아오지 않으니(A1로 간다) 활성 탭을 표시하지 않는다. */}
      <BottomTabBar />
    </section>
  );
}
