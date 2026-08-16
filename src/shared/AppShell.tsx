import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import iconLogo from "../assets/mypage/icon-logo.svg";
import iconBack from "../assets/mypage/icon-back.svg";

/**
 * 홈/기록 아이콘은 `<img src="...svg">`가 아니라 인라인 SVG로 그린다.
 * 다운로드한 svg 파일은 피그마에서 캡처한 한쪽 색(회색/검정)이 고정으로 박혀 있어서,
 * `<img>`로 쓰면 활성/비활성 상태에 따라 색이 바뀌지 않는 버그가 있었다 (2026-08-15).
 * `currentColor`를 쓰면 부모의 text 색(활성 여부)을 그대로 따라간다.
 */
function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11L12 4L20 11V20H4V11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3H18V21L12 16.5L6 21V3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 피그마 v3(사용자 화면 10 · 인플루언서 화면 11) 공용 조각.
 * 검정/화이트 톤의 모바일 프레임 화면들(U2, U8, U9, I-화면)이 함께 쓴다.
 * 기존 `FlowShell`/`SiteNav`(보라 톤, 2단 레이아웃)와는 별도 계통이다 —
 * 두 디자인이 화면마다 섞여 있는 과도기라 컴포넌트를 나눠 뒀다.
 */

export function Pill({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={
        tone === "dark"
          ? "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[#0a0a0a] px-3 py-[6px] text-[11px] font-semibold tracking-[-0.055px] text-white"
          : "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-[#e8e8ec] bg-white px-3 py-[6px] text-[11px] font-semibold tracking-[-0.055px] text-[#3c3c43]"
      }
    >
      {children}
    </span>
  );
}

/** 로고+로그아웃 상단바(마이페이지형) 또는 뒤로가기 상단바(상세형). 필요에 맞게 하나만 쓴다. */
export function TopBar({
  title,
  onBack,
  onLogout,
}: {
  title?: string;
  onBack?: () => void;
  onLogout?: () => void;
}) {
  if (onBack) {
    return (
      <div className="flex min-h-[52px] items-center gap-[10px] py-3 pl-[14px] pr-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로가기"
          className="flex size-[26px] shrink-0 items-center justify-center"
        >
          <img src={iconBack} alt="" className="size-[26px]" />
        </button>
        {title ? <p className="truncate text-[16px] font-semibold text-[#0a0a0a]">{title}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex min-h-[56px] items-center gap-[9px] px-5">
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#0a0a0a]">
        <img src={iconLogo} alt="" className="size-[18px]" />
      </span>
      <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">Fitto</p>
      <div className="flex-1" />
      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          className="text-[13px] font-medium tracking-[-0.195px] text-[#8e8e93]"
        >
          로그아웃
        </button>
      ) : null}
    </div>
  );
}

/**
 * U3 입력 단계 공용 헤더: 뒤로가기 + 진행률 바 + 제목/설명.
 * `progress`는 0~1 (전체 진행률), `stepLabel`은 피그마에 쓰인 `n / 5` 표기 그대로 넘긴다 —
 * 물리적 화면은 6개지만 피그마 라벨은 5단계 기준이라 그대로 따른다.
 */
export function StepHeader({
  stepLabel,
  progress,
  title,
  description,
  onBack,
}: {
  stepLabel: string;
  progress: number;
  title: ReactNode;
  description?: ReactNode;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex min-h-[52px] items-center gap-[10px] py-3 pl-[14px] pr-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로가기"
          className="flex size-[26px] shrink-0 items-center justify-center"
        >
          <img src={iconBack} alt="" className="size-[26px]" />
        </button>
        <div className="flex-1" />
        <p className="text-[13px] font-medium tracking-[-0.195px] text-[#8e8e93]">{stepLabel}</p>
      </div>
      <div className="px-5">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#e8e8ec]">
          <div
            className="h-[3px] rounded-full bg-[#0a0a0a] transition-[width] duration-300"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </div>
      </div>
      <div className="px-5 pt-[22px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">{title}</h1>
        {description ? (
          <p className="mt-[10px] text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#8e8e93]">
            {description}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** 선택형 알약 버튼. 체형·핏고민·스타일·키워드·구매기준·TPO 등 대부분의 선택지에 재사용한다. */
export function SelectChip({
  children,
  selected,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** 화면에 보이는 글자와 다른 접근성 이름이 필요할 때만 넘긴다 (예: 상태 배지와 같은 문구를 쓰는 필터 버튼). */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={
        selected
          ? "inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full border border-[#0a0a0a] bg-[#0a0a0a] px-[15px] text-[14px] font-medium tracking-[-0.21px] text-white disabled:opacity-40"
          : "inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full border border-[#e8e8ec] bg-white px-[15px] text-[14px] font-medium tracking-[-0.21px] text-[#3c3c43] disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

/** 화면 하단 고정 검정 CTA 1개. */
export function PrimaryCta({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-5 pb-[10px] pt-[10px]">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-40"
      >
        {children}
      </button>
    </div>
  );
}

/** 하단 탭바 (`홈` · `기록`). `홈`은 맨 처음 마케팅 화면인 A1(`/`)로 보낸다 —
 * 한동안 U2(스타일링 유형 선택)로 보냈었는데, 다시 A1로 되돌렸다 (2026-08-16 요청).
 * `기록`(마이페이지)은 `RequireRole`이 로그인 여부를 확인해서, 로그인 안 한 상태로
 * 들어오면 로그인 화면으로 돌려보낸다.
 *
 * `active`를 생략하면 두 탭 다 활성 표시를 안 한다 — U2(스타일링 유형 선택)처럼
 * '홈'을 눌러도 지금 화면으로 돌아오지 않는 중간 화면에서 쓴다.
 */
export function BottomTabBar({ active }: { active?: "home" | "records" }) {
  const navigate = useNavigate();
  return (
    <nav className="flex items-start border-t border-[#e8e8ec] bg-white pb-[22px] pt-[10px]" aria-label="하단 메뉴">
      <button
        type="button"
        onClick={() => navigate("/")}
        className={`flex flex-1 flex-col items-center gap-[5px] py-1 ${
          active === "home" ? "text-[#0a0a0a]" : "text-[#8e8e93]"
        }`}
      >
        <HomeIcon />
        <span className="text-[11px] font-semibold tracking-[-0.055px]">홈</span>
      </button>
      <button
        type="button"
        onClick={() => navigate("/user/mypage")}
        className={`flex flex-1 flex-col items-center gap-[5px] py-1 ${
          active === "records" ? "text-[#0a0a0a]" : "text-[#8e8e93]"
        }`}
      >
        <BookmarkIcon />
        <span className="text-[11px] font-semibold tracking-[-0.055px]">기록</span>
      </button>
    </nav>
  );
}
