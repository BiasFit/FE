import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupOutfitDraft, OutfitFields as OutfitFieldValues, PersonalOutfitDraft } from "../../app/types.js";
import type { OutfitReviewResponse } from "../../domain/aiContracts.js";
import { useAppState } from "../../app/AppStateProvider.js";
import { useAuth } from "../../app/AuthProvider.js";
import {
  TPO_CODES,
  bodyTypes,
  budgetApproaches,
  budgetRangeLabel,
  fitConcerns,
  styleOptions,
  tpoLabel,
} from "../../data/options.js";
import type { CoachingSupport } from "../../domain/scoring.js";
import { isValidOutfitDraft, isValidProductUrl, toOutfitReviewRequest } from "../../domain/outfit.js";
import {
  deliverOutfitCard,
  getAssignedRequests,
  getDiagnosisResult,
  getOutfitCard,
  saveInfluencerProfile,
  type AssignedRequestView,
  type DiagnosisResultView,
  type OutfitCardView,
} from "../../lib/biasfitApi.js";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type OutfitDraft,
} from "../../storage/drafts.js";
import { BudgetRangeSlider } from "../../shared/BudgetRangeSlider.js";
import { OutfitReviewPanel } from "./OutfitReviewPanel.js";
import { Pill, PrimaryCta, SelectChip, StepHeader, TopBar } from "../../shared/AppShell.js";
import iconAvatar from "../../assets/mypage/icon-avatar.svg";
import iconCheck from "../../assets/mypage/icon-check.svg";
import iconChevronDown from "../../assets/mypage/icon-chevron-down.svg";
import iconItemPlaceholder from "../../assets/mypage/icon-item-placeholder.svg";

/**
 * 빈 초안으로 시작한다.
 *
 * 예시 제품명과 example.com 링크를 미리 채워 두면 인플루언서가 그대로 전달했을 때
 * 사용자에게 존재하지 않는 상품이 간다. 작성은 반드시 빈 칸에서 시작해야 한다.
 */
const emptyProduct = { name: "", url: "" };

const personalDefault: PersonalOutfitDraft = {
  title: "",
  top: { ...emptyProduct },
  bottom: { ...emptyProduct },
  message: "",
};

const groupDefault: GroupOutfitDraft = {
  memberA: { top: { ...emptyProduct }, bottom: { ...emptyProduct } },
  memberB: { top: { ...emptyProduct }, bottom: { ...emptyProduct } },
  title: "",
  message: "",
};

/** I1 · 인플루언서 로그인. */
export function InfluencerLoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loginId, setLoginId] = useState("stylemate01");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const login = () => {
    setLoggingIn(true);
    setLoginError("");
    void signIn({ loginId, password })
      .then((account) => {
        // 사용자 계정으로 인플루언서 워크스페이스에 들어오는 것을 막는다
        // (INFLUENCER_SCREEN_SPEC.md 3.1 역할 판별 규칙).
        navigate(account.role === "influencer" ? "/influencer/requests" : "/user/coaching");
      })
      .catch((error: unknown) => {
        setLoginError(error instanceof Error ? error.message : "로그인하지 못했어요.");
        setLoggingIn(false);
      });
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[76px]">
        <div>
          <Pill tone="dark">인플루언서</Pill>
        </div>
        <div className="h-[26px]" />
        <h1 className="m-0 text-[30px] font-bold leading-[1.28] tracking-[-0.9px] text-[#0a0a0a]">
          배정된 요청을 확인하고
          <br />
          코디 카드를 전달하세요.
        </h1>
        <div className="h-3" />
        <p className="text-[15px] text-[#3c3c43]">사전에 안내된 개인 테스트 계정으로 로그인해 주세요.</p>
        <div className="h-[44px]" />
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">테스트 아이디</span>
            <input
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className="flex min-h-[56px] w-full items-center rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold text-[#0a0a0a] outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">테스트 코드</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex min-h-[56px] w-full items-center rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold text-[#0a0a0a] outline-none"
            />
          </label>
        </div>
        <div className="h-[18px]" />
        <p className="text-[12px] leading-[1.4] text-[#8e8e93]">
          실제 개인정보와 신체 사진은 입력하지 않아요.
          <br />
          로그인하면 계정의 역할을 자동으로 확인해요.
        </p>
        {loginError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]" aria-live="polite">
            {loginError}
          </p>
        ) : null}
      </div>
      <PrimaryCta onClick={login} disabled={loggingIn || !loginId.trim() || !password}>
        {loggingIn ? "로그인하는 중이에요." : "로그인"}
      </PrimaryCta>
      <div className="flex flex-col items-center gap-2 pb-[22px]">
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          처음이신가요? 회원가입
        </button>
        <button
          type="button"
          onClick={() => navigate("/user/login")}
          className="text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          사용자로 로그인
        </button>
      </div>
    </section>
  );
}

/** 인플루언서 강점 TPO는 정확히 3개다 (STYLE_SCORING_DRAFT.md 2.4, README 제품 규칙). */
const REQUIRED_PROFILE_TPO_COUNT = 3;

const COACHING_TYPE_LABEL: Record<CoachingSupport, string> = {
  personal_only: "개인 스타일링만",
  group_only: "2인 그룹 스타일링만",
  both: "개인·2인 그룹 모두",
};

/**
 * I2~I4 세 화면(프로필 1/3·2/3·3/3)에 걸쳐 쓰는 초안.
 * 서버에 저장해야 의미가 생기는 임시값이라 AppState까지 들고 가지 않고
 * 모듈 스코프에만 둔다 — 화면을 오가는 동안만 살아있으면 된다.
 */
const influencerProfileDraft = {
  primaryStyle: "로맨틱",
  secondaryStyle: "캐주얼",
  bodyType: "웨이브",
  fitConcerns: ["밑위·하의 길이", "전체 기장·비율"] as string[],
  budgetMinCode: 2,
  budgetMaxCode: 3,
  budgetApproach: budgetApproaches[0] as string,
  tpos: ["new_semester", "daily", "travel"] as string[],
  coachingType: "both" as CoachingSupport,
};

/** I2 · 프로필 1/3 대표 스타일. */
export function InfluencerProfileScreen() {
  const navigate = useNavigate();
  const [primaryStyle, setPrimaryStyle] = useState(influencerProfileDraft.primaryStyle);
  const [secondaryStyle, setSecondaryStyle] = useState(influencerProfileDraft.secondaryStyle);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="1 / 3"
        progress={1 / 3}
        onBack={() => navigate("/influencer/login")}
        title={
          <>
            사용자와의 매칭에 활용될
            <br />
            스타일링 정보를 입력해 주세요.
          </>
        }
        description={
          <>
            프로필은 첫 로그인에 1회만 작성해요.
            <br />
            완료 후에는 수정할 수 없으니 신중히 입력해 주세요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[34px]">
        <div className="flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">대표 스타일 1순위</p>
          <p className="text-[12px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex gap-[11px] overflow-x-auto pb-1" role="radiogroup" aria-label="대표 스타일 1순위">
          {styleOptions.map((style) => {
            const selected = primaryStyle === style.name;
            return (
              <button
                key={style.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (style.name !== secondaryStyle) setPrimaryStyle(style.name);
                }}
                className="flex w-[122px] shrink-0 flex-col items-start gap-[9px]"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[153px] w-[122px] items-center justify-center rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[153px] w-[122px] items-center justify-center rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  <img src={iconAvatar} alt="" className="size-6" />
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-6" /> : null}
                </span>
                <span
                  className={selected ? "text-[12px] font-bold text-[#0a0a0a]" : "text-[12px] font-medium text-[#3c3c43]"}
                >
                  {style.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-[34px] flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">대표 스타일 2순위</p>
          <p className="text-[12px] text-[#8e8e93]">1순위와 중복 불가</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {styleOptions.map((style) => (
            <SelectChip
              key={style.name}
              selected={secondaryStyle === style.name}
              disabled={primaryStyle === style.name}
              onClick={() => setSecondaryStyle(style.name)}
            >
              {style.name}
            </SelectChip>
          ))}
        </div>
        <p className="mt-5 text-[12px] text-[#8e8e93]">1순위와 2순위는 매칭 점수의 스타일 항목에 함께 반영돼요.</p>
      </div>
      <PrimaryCta
        onClick={() => {
          influencerProfileDraft.primaryStyle = primaryStyle;
          influencerProfileDraft.secondaryStyle = secondaryStyle;
          navigate("/influencer/profile/body");
        }}
        disabled={primaryStyle === secondaryStyle}
      >
        다음
      </PrimaryCta>
    </section>
  );
}

/** I3 · 프로필 2/3 담당 범위. */
export function InfluencerProfileBodyScreen() {
  const navigate = useNavigate();
  const [bodyType, setBodyType] = useState(influencerProfileDraft.bodyType);
  const [concerns, setConcerns] = useState<string[]>(influencerProfileDraft.fitConcerns);

  const toggleConcern = (value: string) => {
    if (concerns.includes(value)) {
      setConcerns(concerns.filter((item) => item !== value));
    } else if (concerns.length < 3) {
      setConcerns([...concerns, value]);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="2 / 3"
        progress={2 / 3}
        onBack={() => navigate("/influencer/profile")}
        title={
          <>
            어떤 핏 고민을
            <br />
            자주 다루나요?
          </>
        }
        description="사용자가 입력한 핏 고민과 같은 기준으로 비교돼요."
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[34px]">
        <div className="flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">본인의 체형 유형</p>
          <p className="text-[12px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex gap-[10px]" role="radiogroup" aria-label="본인의 체형 유형">
          {bodyTypes.map((type) => {
            const selected = bodyType === type.name;
            return (
              <button
                key={type.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setBodyType(type.name)}
                className="flex w-[111px] flex-col items-start gap-[9px]"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[139px] w-[111px] items-center justify-center rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[139px] w-[111px] items-center justify-center rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  <img src={iconAvatar} alt="" className="size-6" />
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-6" /> : null}
                </span>
                <span
                  className={selected ? "text-[12px] font-bold text-[#0a0a0a]" : "text-[12px] font-medium text-[#3c3c43]"}
                >
                  {type.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-[34px] flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">자주 다루는 핏 고민</p>
          <p className="text-[12px] text-[#8e8e93]">{concerns.length} / 3</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {fitConcerns.map((concern) => (
            <SelectChip
              key={concern}
              selected={concerns.includes(concern)}
              disabled={!concerns.includes(concern) && concerns.length >= 3}
              onClick={() => toggleConcern(concern)}
            >
              {concern}
            </SelectChip>
          ))}
        </div>
        <p className="mt-5 text-[12px] text-[#8e8e93]">1~3개까지 고를 수 있어요.</p>
      </div>
      <PrimaryCta
        onClick={() => {
          influencerProfileDraft.bodyType = bodyType;
          influencerProfileDraft.fitConcerns = concerns;
          navigate("/influencer/profile/budget");
        }}
        disabled={concerns.length === 0}
      >
        다음
      </PrimaryCta>
    </section>
  );
}

/** I4 · 프로필 3/3 가격과 TPO. */
export function InfluencerProfileBudgetScreen() {
  const navigate = useNavigate();
  const [budgetMinCode, setBudgetMinCode] = useState(influencerProfileDraft.budgetMinCode);
  const [budgetMaxCode, setBudgetMaxCode] = useState(influencerProfileDraft.budgetMaxCode);
  const [budgetApproach, setBudgetApproach] = useState(influencerProfileDraft.budgetApproach);
  const [occasions, setOccasions] = useState<string[]>(influencerProfileDraft.tpos);
  const [coachingType, setCoachingType] = useState<CoachingSupport>(influencerProfileDraft.coachingType);
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const toggleOccasion = (value: string) => {
    if (occasions.includes(value)) {
      setOccasions(occasions.filter((item) => item !== value));
    } else if (occasions.length < REQUIRED_PROFILE_TPO_COUNT) {
      setOccasions([...occasions, value]);
    }
  };

  // 강점 TPO는 사용자 TPO 후보와 같은 8개에서 정확히 고른다 (STYLE_SCORING_DRAFT.md 2.4).
  const valid = occasions.length === REQUIRED_PROFILE_TPO_COUNT;

  const submit = () => {
    if (!valid) {
      setShowError(true);
      return;
    }
    setSaving(true);
    setSaveError("");
    // 서버에 저장해야 매칭 후보가 된다. localStorage에만 두면 아무도 찾지 못한다.
    void saveInfluencerProfile({
      primaryStyle: influencerProfileDraft.primaryStyle,
      secondaryStyle: influencerProfileDraft.secondaryStyle,
      bodyType: influencerProfileDraft.bodyType,
      fitConcerns: influencerProfileDraft.fitConcerns,
      budgetMinCode,
      budgetMaxCode,
      budgetApproach,
      tpos: occasions,
      coachingType,
    })
      .then(() => navigate("/influencer/requests"))
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "프로필을 저장하지 못했어요.");
        setSaving(false);
      });
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="3 / 3"
        progress={1}
        onBack={() => navigate("/influencer/profile/body")}
        title={
          <>
            담당 가능한 가격대와
            <br />
            강점 상황을 알려주세요.
          </>
        }
        description="코디 세트 1개(상의 1개 + 하의 1개) 총액 기준이에요."
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[34px]">
        <p className="text-[30px] font-bold leading-[1.28] tracking-[-0.9px] text-[#0a0a0a]">
          {budgetRangeLabel(budgetMinCode, budgetMaxCode)}
        </p>
        <div className="mt-[18px]">
          <BudgetRangeSlider
            minCode={budgetMinCode}
            maxCode={budgetMaxCode}
            onChange={({ minCode, maxCode }) => {
              setBudgetMinCode(minCode);
              setBudgetMaxCode(maxCode);
            }}
          />
        </div>

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">예산 접근 방식</p>
          <p className="text-[12px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {budgetApproaches.map((approach) => (
            <SelectChip key={approach} selected={budgetApproach === approach} onClick={() => setBudgetApproach(approach)}>
              {approach}
            </SelectChip>
          ))}
        </div>

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">강점 상황 (TPO)</p>
          <p className="text-[12px] text-[#8e8e93]">{occasions.length} / {REQUIRED_PROFILE_TPO_COUNT}</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {TPO_CODES.map((code) => (
            <SelectChip
              key={code}
              selected={occasions.includes(code)}
              disabled={!occasions.includes(code) && occasions.length >= REQUIRED_PROFILE_TPO_COUNT}
              onClick={() => toggleOccasion(code)}
            >
              {tpoLabel(code)}
            </SelectChip>
          ))}
        </div>

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">지원 스타일링 유형</p>
          <p className="text-[12px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {(Object.keys(COACHING_TYPE_LABEL) as CoachingSupport[]).map((value) => (
            <SelectChip key={value} selected={coachingType === value} onClick={() => setCoachingType(value)}>
              {COACHING_TYPE_LABEL[value]}
            </SelectChip>
          ))}
        </div>
        <p className="mt-5 text-[12px] text-[#8e8e93]">지원 유형은 후보 자격만 판단하고 매칭 점수에는 들어가지 않아요.</p>

        {showError && !valid ? (
          <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]">강점 상황(TPO)을 정확히 {REQUIRED_PROFILE_TPO_COUNT}개 골라주세요.</p>
        ) : null}
        {saveError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]" aria-live="polite">
            {saveError}
          </p>
        ) : null}
      </div>
      <PrimaryCta onClick={submit} disabled={saving}>
        {saving ? "저장하는 중이에요." : "프로필 완성하기"}
      </PrimaryCta>
    </section>
  );
}

function requestSentAtLabel(sentAt: string | null) {
  if (!sentAt) return "전송 시각 없음";
  const date = new Date(sentAt);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${min} 요청`;
}

/** I5 · 스타일링 요청 목록. */
export function InfluencerRequestsScreen() {
  const navigate = useNavigate();
  const { dispatch } = useAppState();
  const { account, signOut } = useAuth();
  const [requests, setRequests] = useState<AssignedRequestView[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [filter, setFilter] = useState<"all" | "needed" | "delivered">("all");

  // 내게 배정된 요청만 받는다. 수신자 판별은 서버가 토큰으로 한다.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void getAssignedRequests(controller.signal)
      .then(({ requests: list }) => {
        setRequests(list);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 배정 요청 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [account?.accountId]);

  const visibleRequests = requests.filter((request) => {
    if (filter === "needed") return !request.delivered;
    if (filter === "delivered") return request.delivered;
    return true;
  });

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <div className="flex min-h-[56px] items-center gap-[9px] px-5">
        <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">Fitto</p>
        <Pill>인플루언서</Pill>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate("/"))}
          className="text-[12px] font-medium text-[#8e8e93]"
        >
          로그아웃
        </button>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-2">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          스타일링 요청 목록
        </h1>
        <p className="mt-[10px] text-[15px] leading-[1.52] text-[#8e8e93]">
          나에게 배정된 요청만 보여요.
          <br />
          코디 카드는 요청당 1회 전달할 수 있어요.
        </p>
        {/*
          탭 라벨이 상태 배지("작성 필요"/"전달 완료")와 같은 글자를 써서, 일반 button
          role로 두면 테스트/스크린리더가 요청 카드 버튼과 헷갈린다. role="tab"으로
          분리해 둔다.
        */}
        <div className="mt-[26px] flex gap-2" role="tablist" aria-label="요청 상태 필터">
          {(
            [
              ["all", "전체"],
              ["needed", "작성 필요"],
              ["delivered", "전달 완료"],
            ] as const
          ).map(([value, label]) => {
            const selected = filter === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(value)}
                className={
                  selected
                    ? "inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full border border-[#0a0a0a] bg-[#0a0a0a] px-[15px] text-[14px] font-medium tracking-[-0.21px] text-white"
                    : "inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full border border-[#e8e8ec] bg-white px-[15px] text-[14px] font-medium tracking-[-0.21px] text-[#3c3c43]"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-[22px] flex flex-col gap-3">
          {status === "loading" ? <p className="text-[13px] text-[#8e8e93]">배정된 요청을 불러오는 중이에요.</p> : null}
          {status === "error" ? <p className="text-[13px] text-[#8e8e93]">배정 요청을 불러오지 못했어요.</p> : null}
          {status === "success" && visibleRequests.length === 0 ? (
            <div className="rounded-[18px] bg-[#f5f5f7] p-5 text-center">
              <p className="text-[14px] text-[#0a0a0a]">아직 배정된 요청이 없어요.</p>
              <p className="mt-1 text-[13px] text-[#8e8e93]">사용자가 부탁해요 카드를 보내면 여기에 표시돼요.</p>
            </div>
          ) : null}
          {visibleRequests.map((request) => (
            <button
              key={request.requestCardId}
              type="button"
              aria-label={`요청 ${request.delivered ? "전달 완료" : "작성 필요"}`}
              onClick={() => {
                // 상세 화면이 이 매칭 id로 사용자 진단 결과를 조회한다.
                dispatch({ type: "selectRequest", requestId: request.matchResultId });
                navigate(request.delivered ? "/influencer/delivered" : "/influencer/detail");
              }}
              className={
                request.delivered
                  ? "flex flex-col items-start rounded-[20px] bg-[#f5f5f7] px-5 pb-[18px] pt-5 text-left"
                  : "flex flex-col items-start rounded-[20px] border-[1.6px] border-[#0a0a0a] bg-white px-5 pb-[18px] pt-5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
              }
            >
              <div className="flex w-full items-center gap-[10px]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ededf0]">
                  <img src={iconAvatar} alt="" className="size-[22px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">
                    {request.coachingType === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}
                  </p>
                  <p className="truncate text-[11px] text-[#8e8e93]">{requestSentAtLabel(request.sentAt)}</p>
                </div>
                <Pill tone={request.delivered ? "light" : "dark"}>{request.delivered ? "전달 완료" : "작성 필요"}</Pill>
              </div>
              <div className="mt-4 flex flex-wrap gap-[6px]">
                <Pill>{request.coachingType === "group" ? "2인 그룹" : "개인"}</Pill>
                <Pill>{request.tpoLabel}</Pill>
              </div>
              <div className="mt-[14px] flex w-full items-center gap-[6px] border-t border-[#e8e8ec] pt-[14px]">
                <span className="text-[12px] text-[#0a0a0a]">
                  {request.delivered ? "전달한 카드 보기" : "요청 내용 보기"}
                </span>
                <div className="flex-1" />
                <span aria-hidden="true" className="text-[#8e8e93]">
                  ›
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function isGroupDraft(draft: OutfitDraft): draft is GroupOutfitDraft {
  return "memberA" in draft;
}

export function InfluencerDetailScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const { account } = useAuth();
  // 임시저장은 로그인한 계정 것만 열린다. 고정 id를 쓰면 다른 사람의 초안이 열린다.
  const draftOwner = account?.loginId ?? "unknown";

  // 사용자가 실제로 입력한 값을 읽는다. 고정 문구를 쓰면 누가 무엇을 입력했든 같은 화면이 된다.
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultView | null>(null);
  const [diagnosisStatus, setDiagnosisStatus] =
    useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!state.activeRequestId) return;
    const controller = new AbortController();
    setDiagnosisStatus("loading");
    void getDiagnosisResult(state.activeRequestId, controller.signal)
      .then((result) => {
        setDiagnosis(result);
        setDiagnosisStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 진단 결과 조회 실패", error);
        setDiagnosisStatus("error");
      });
    return () => controller.abort();
  }, [state.activeRequestId]);

  const group = diagnosis ? diagnosis.coachingType === "group" : state.mode === "group";
  const initial = useMemo(() => {
    const saved = loadDraft(draftOwner, state.activeRequestId);
    if (saved && isGroupDraft(saved) === group) return saved;
    return group ? groupDefault : personalDefault;
  }, [draftOwner, group, state.activeRequestId]);
  const [draft, setDraft] = useState<OutfitDraft>(initial);
  const [draftState, setDraftState] = useState("모든 변경사항 저장됨");
  const [modal, setModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reviewResult, setReviewResult] = useState<OutfitReviewResponse | null>(null);
  const [deliverError, setDeliverError] = useState("");
  const [openSection, setOpenSection] = useState<"dna" | "request" | null>("dna");
  const draftValid = isValidOutfitDraft(draft);

  useEffect(() => {
    setReviewStatus("idle");
    setReviewResult(null);
    setDeliverError("");
    setDraftState("저장 중…");
    const timer = window.setTimeout(() => {
      saveDraft(draftOwner, state.activeRequestId, draft);
      setDraftState("자동 저장됨");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draft, draftOwner, state.activeRequestId]);

  /**
   * 전달은 서버 한 곳에서만 일어난다.
   *
   * 검수(링크·안전 표현)와 저장이 같은 요청 안에서 순서대로 돌기 때문에,
   * "검수는 통과했는데 저장이 안 된" 상태나 그 반대가 생기지 않는다.
   * 통과하지 못하면 서버는 아무것도 저장하지 않고 검수 내역만 돌려준다.
   */
  const deliver = async () => {
    setReviewStatus("loading");
    setReviewResult(null);
    setDeliverError("");
    try {
      const request = toOutfitReviewRequest(draft);
      const result = await deliverOutfitCard({
        matchResultId: state.activeRequestId,
        title: draft.title,
        message: draft.message,
        cards: request.cards,
      });
      setReviewResult(result.review);
      setReviewStatus("success");
      if (result.delivered) {
        // 전달됐으니 이 요청의 임시저장은 지운다 (INFLUENCER_SCREEN_SPEC.md 3.4).
        clearDraft(draftOwner, state.activeRequestId);
        navigate("/influencer/delivered");
      }
    } catch (error) {
      setReviewStatus("error");
      setDeliverError(
        error instanceof Error ? error.message : "코디 카드를 전달하지 못했어요.",
      );
    }
  };

  const setPersonal = (
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => {
    if (!isGroupDraft(draft)) {
      setDraft({ ...draft, [key]: { ...draft[key], [field]: value } });
    }
  };
  const setGroup = (
    member: "memberA" | "memberB",
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => {
    if (isGroupDraft(draft)) {
      setDraft({
        ...draft,
        [member]: {
          ...draft[member],
          [key]: { ...draft[member][key], [field]: value },
        },
      });
    }
  };

  return (
    <>
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
        <TopBar onBack={() => navigate("/influencer/requests")} />
        <div className="flex items-center gap-2 border-y border-[#e8e8ec] px-5 py-[10px]">
          <p className="text-[12px] text-[#3c3c43]">
            {/* 피그마엔 "bf.user01 · 개인 · 개강 행사"처럼 요청자 이름이 있지만,
                진단 결과 응답에 사용자 로그인 아이디가 없어서 뺐다 (요청자 표시 항목 참고). */}
            {diagnosis
              ? `${diagnosis.coachingType === "group" ? "2인 그룹" : "개인"} · ${diagnosis.tpoLabel}`
              : "요청 내용을 불러오는 중이에요."}
          </p>
          <div className="flex-1" />
          <Pill tone="dark">작성 필요</Pill>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.6px] text-[#0a0a0a]">코디 카드 작성</h1>
          <div className="h-5" />

          {(
            <div className="flex flex-col gap-[11px] rounded-[18px] bg-[#f5f5f7] px-[18px] pb-[14px] pt-[6px]">
              <div className="flex gap-[14px] py-[11px]">
                <p className="w-[92px] shrink-0 text-[12px] text-[#8e8e93]">필요한 상황</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">{diagnosis?.tpoLabel ?? "—"}</p>
              </div>
              <div className="flex gap-[14px] py-[11px]">
                <p className="w-[92px] shrink-0 text-[12px] text-[#8e8e93]">공통 조건</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {diagnosis
                    ? `${diagnosis.coachingType === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}${
                        diagnosis.groupCombination?.score != null ? ` · 그룹 스타일 조합도 ${diagnosis.groupCombination.score}` : ""
                      }`
                    : "—"}
                </p>
              </div>
              <div className="flex gap-[14px] py-[11px]">
                <p className="w-[92px] shrink-0 text-[12px] text-[#8e8e93]">요청 예산</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {/* 예산은 요청 정보라서 인플루언서가 수정하지 않는다 (INFLUENCER_SCREEN_SPEC.md 3.4). */}
                  {diagnosis?.members
                    .map((member) => (member.memberLabel === "self" ? member.budgetLabel : `${member.memberLabel} ${member.budgetLabel}`))
                    .join(" · ") || "—"}
                </p>
              </div>
              <p className="text-[11px] font-semibold text-[#8e8e93]">요청 정보는 수정할 수 없어요.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === "dna" ? null : "dna"))}
            className="mt-[26px] flex w-full items-center gap-[10px] border-t border-[#e8e8ec] py-[18px]"
          >
            <span className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">스타일 진단 결과</span>
            <div className="flex-1" />
            <img src={iconChevronDown} alt="" className={`size-[22px] transition-transform ${openSection === "dna" ? "rotate-180" : ""}`} />
          </button>
          {openSection === "dna" ? (
            <>
              {diagnosisStatus === "loading" ? <p className="text-[13px] text-[#8e8e93]">진단 결과를 불러오는 중이에요.</p> : null}
              {diagnosisStatus === "error" ? <p className="text-[13px] text-[#8e8e93]">진단 결과를 불러오지 못했어요.</p> : null}
              {diagnosis ? (
                <>
                  <p className="text-[15px] leading-[1.52] text-[#0a0a0a]">{diagnosis.styleDnaSummary}</p>
                  {diagnosis.members[0]?.keywords.length ? (
                    <div className="mt-3 flex flex-wrap gap-[6px]">
                      {diagnosis.members[0].keywords.map((keyword) => (
                        <Pill key={keyword}>#{keyword}</Pill>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-col">
                    {diagnosis.members.map((member) => (
                      <div key={member.memberLabel} className="flex gap-[14px] py-[11px]">
                        <p className="w-[92px] shrink-0 text-[12px] text-[#8e8e93]">
                          {member.memberLabel === "self" ? "핏 고민" : `${member.memberLabel} 핏 고민`}
                        </p>
                        <p className="flex-1 text-[15px] text-[#0a0a0a]">{member.fitConcerns.join(" / ") || "—"}</p>
                      </div>
                    ))}
                    {diagnosis.members.map((member) => (
                      <div key={`${member.memberLabel}-pref`} className="flex gap-[14px] py-[11px]">
                        <p className="w-[92px] shrink-0 text-[12px] text-[#8e8e93]">
                          {member.memberLabel === "self" ? "선호 / 비선호" : `${member.memberLabel} 선호/비선호`}
                        </p>
                        <p className="flex-1 text-[15px] text-[#0a0a0a]">
                          {member.preferredStyle} / {member.avoidedStyle}
                        </p>
                      </div>
                    ))}
                  </div>
                  {diagnosis.members[0]?.preferredItems.length ? (
                    <>
                      <p className="mt-1 text-[11px] font-semibold text-[#8e8e93]">선호 아이템</p>
                      <div className="mt-[10px] flex gap-[10px]">
                        {diagnosis.members[0].preferredItems.map((item) => (
                          <div key={item} className="flex flex-col items-center gap-[7px]">
                            <span className="flex size-14 items-center justify-center rounded-[12px] bg-[#f2f2f5]">
                              <img src={iconItemPlaceholder} alt="" className="size-[22px]" />
                            </span>
                            <p className="max-w-[70px] text-center text-[11px] font-semibold text-[#3c3c43]">{item}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === "request" ? null : "request"))}
            className="flex w-full items-center gap-[10px] border-t border-[#e8e8ec] py-[18px]"
          >
            <span className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">부탁해요 카드</span>
            <div className="flex-1" />
            <img
              src={iconChevronDown}
              alt=""
              className={`size-[22px] transition-transform ${openSection === "request" ? "rotate-180" : ""}`}
            />
          </button>
          {openSection === "request" ? (
            <div className="border-b border-[#e8e8ec] pb-5">
              <Pill>읽기 전용</Pill>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.52] text-[#0a0a0a]">
                {/* 사용자가 보낸 원문이다. 브라우저 로컬 값을 읽으면 다른 기기에서 빈 화면이 된다. */}
                {diagnosis?.requestCard?.messageText ||
                  (diagnosisStatus === "loading" ? "요청 내용을 불러오는 중이에요." : "전달된 요청 내용이 없어요.")}
              </p>
              {diagnosis?.requestCard?.sentAt ? (
                <p className="mt-[10px] text-[11px] font-semibold text-[#8e8e93]">
                  {new Date(diagnosis.requestCard.sentAt).toLocaleDateString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                  })}{" "}
                  {new Date(diagnosis.requestCard.sentAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  작성
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-[18px] flex items-center gap-2 rounded-[14px] bg-[#f5f5f7] px-4 py-3">
            <p className="text-[12px] text-[#3c3c43]">{draftState}</p>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => {
                saveDraft(draftOwner, state.activeRequestId, draft);
                setDraftState("임시저장 완료");
              }}
              className="text-[12px] font-semibold text-[#0a0a0a]"
            >
              임시저장
            </button>
          </div>

          <p className="mt-[26px] text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">추천 코디</p>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-[12px] text-[#8e8e93]">코디 카드 제목 (필수)</span>
              <input
                aria-label="코디 카드 제목"
                placeholder="예: 부드러운 캠퍼스 레이어드"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="flex min-h-[54px] w-full items-center rounded-[14px] border border-[#e8e8ec] bg-white px-4 text-[15px] text-[#0a0a0a] outline-none"
              />
            </label>
            {!isGroupDraft(draft) ? (
              <OutfitFields values={draft} onChange={(key, field, value) => setPersonal(key, field, value)} />
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#0a0a0a]">구성원 A</p>
                  <OutfitFields values={draft.memberA} onChange={(key, field, value) => setGroup("memberA", key, field, value)} />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#0a0a0a]">구성원 B</p>
                  <OutfitFields values={draft.memberB} onChange={(key, field, value) => setGroup("memberB", key, field, value)} />
                </div>
              </div>
            )}
          </div>

          {/*
            피그마엔 "bf.user01님께 전하는 말"처럼 요청한 사용자 이름이 들어가는데,
            진단 결과 응답(DiagnosisResultView)에 사용자 로그인 아이디/이름 필드가 없어서
            지어낼 수 없다 — draftOwner는 이 화면을 보는 인플루언서 자신의 계정이라
            여기 쓰면 오히려 틀린 이름이 된다. 데이터가 추가되면 그 필드로 바꾸면 된다.
          */}
          <p className="mt-9 text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">
            요청하신 분께 전하는 말
          </p>
          <textarea
            aria-label="스타일메이트의 한마디"
            value={draft.message}
            onChange={(event) => setDraft({ ...draft, message: event.target.value })}
            className="mt-[14px] min-h-[160px] w-full rounded-[18px] border-[1.6px] border-[#0a0a0a] p-[18px] text-[15px] leading-[1.52] text-[#0a0a0a] outline-none"
          />
          {!draftValid ? (
            <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]">
              코디 카드 제목, 전하는 말, 상의·하의의 제품명과 http:// 또는 https://로 시작하는 상품 링크를 모두 입력해 주세요.
            </p>
          ) : null}
          <p className="mt-5 text-[12px] text-[#8e8e93]">전달 확정 후에는 수정·삭제·재전송을 할 수 없어요.</p>
        </div>
        <PrimaryCta
          disabled={!draftValid}
          onClick={() => {
            setReviewStatus("idle");
            setReviewResult(null);
            setModal(true);
          }}
        >
          코디 카드 전달하기
        </PrimaryCta>
      </section>
      {modal ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deliver-title">
            <h2 id="deliver-title">코디 카드를 전달할까요?</h2>
            <p>안전 표현과 상의·하의 상품 링크 검수를 통과한 뒤에만 전달돼요. 전달 후에는 수정하거나 다시 보낼 수 없어요.</p>
            <div className="soft-card">
              <strong>{draft.title}</strong>
              <p className="helper">{draft.message}</p>
            </div>
            {reviewStatus === "loading" ? <p aria-live="polite">코디 카드를 확인하고 있어요.</p> : null}
            {reviewStatus === "error" ? (
              <p className="error-copy" style={{ display: "block" }} aria-live="polite">
                {deliverError || "코디 카드를 전달하지 못했어요. 다시 시도해 주세요."}
              </p>
            ) : null}
            {reviewResult && reviewResult.reviewStatus !== "pass" ? (
              <>
                <OutfitReviewPanel result={reviewResult} />
                <p className="helper">
                  {/* operations_review는 인플루언서 잘못이 아니다 (INFLUENCER_SCREEN_SPEC.md 3.4). */}
                  {reviewResult.reviewStatus === "operations_review"
                    ? "자동 접속 확인이 막혀 운영진이 확인하고 있어요. 작성한 내용은 그대로 유지했어요."
                    : "수정한 뒤 다시 전달해 주세요. 작성한 내용은 그대로 유지했어요."}
                </p>
              </>
            ) : null}
            <div className="modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setModal(false)}>계속 작성</button>
              <button
                className="btn-primary"
                type="button"
                disabled={reviewStatus === "loading" || !draftValid}
                onClick={() => void deliver()}
              >
                {reviewStatus === "loading"
                  ? "전달하는 중이에요."
                  : reviewResult || deliverError
                    ? "수정 후 다시 전달"
                    : "전달 확정"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OutfitFields({
  values,
  onChange,
}: {
  values: OutfitFieldValues;
  onChange: (
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => void;
}) {
  return (
    <>
      {([
        ["top", "상의"],
        ["bottom", "하의"],
      ] as const).map(([key, label]) => (
        <div className="flex flex-col gap-3" key={key}>
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">{label} · 제품명</span>
            <input
              aria-label={`${label} 제품명`}
              value={values[key].name}
              onChange={(event) => onChange(key, "name", event.target.value)}
              className="flex min-h-[54px] w-full items-center rounded-[14px] border border-[#e8e8ec] bg-white px-4 text-[15px] text-[#0a0a0a] outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[12px] text-[#8e8e93]">{label} · 제품 링크</span>
            <input
              aria-label={`${label} 상품 링크`}
              type="url"
              placeholder="https://example.com/product"
              value={values[key].url}
              onChange={(event) => onChange(key, "url", event.target.value)}
              className={
                values[key].url && !isValidProductUrl(values[key].url)
                  ? "flex min-h-[54px] w-full items-center rounded-[14px] border border-[#0a0a0a] bg-white px-4 text-[15px] text-[#0a0a0a] outline-none"
                  : "flex min-h-[54px] w-full items-center rounded-[14px] border border-[#e8e8ec] bg-white px-4 text-[15px] text-[#0a0a0a] outline-none"
              }
            />
            {values[key].url && !isValidProductUrl(values[key].url) ? (
              <span className="text-[12px] font-semibold text-[#0a0a0a]">유효한 http/https 링크를 입력해 주세요.</span>
            ) : null}
          </label>
        </div>
      ))}
    </>
  );
}

export function DeliveredScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const [card, setCard] = useState<OutfitCardView | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // 전달한 카드를 서버에서 다시 읽는다. 화면에 남은 초안을 보여주면
  // 실제로 전달된 내용과 달라질 수 있다.
  useEffect(() => {
    if (!state.activeRequestId) {
      setStatus("success");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void getOutfitCard(state.activeRequestId, controller.signal)
      .then((result) => {
        setCard(result.card);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 코디 카드 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [state.activeRequestId]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <div className="flex min-h-[56px] items-center gap-[9px] px-5">
        <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">Fitto</p>
        <div className="flex-1" />
        <button type="button" onClick={() => navigate("/")} className="text-[12px] font-medium text-[#8e8e93]">
          로그아웃
        </button>
      </div>
      <div className="flex flex-1 flex-col px-5 py-6">
        <div>
          <Pill tone="dark">전달 완료</Pill>
        </div>
        <div className="h-[18px]" />
        <h1 className="m-0 text-[30px] font-bold leading-[1.28] tracking-[-0.9px] text-[#0a0a0a]">
          코디 카드가
          <br />
          전달됐어요.
        </h1>
        <div className="h-3" />
        <p className="text-[15px] text-[#3c3c43]">읽기 전용으로 열람 중이에요. 배정 요청 목록에서 다시 찾을 수 있어요.</p>
        <div className="h-9" />

        {status === "loading" ? <p className="text-[13px] text-[#8e8e93]">전달한 코디 카드를 불러오는 중이에요.</p> : null}
        {status === "error" ? <p className="text-[13px] text-[#8e8e93]">전달된 코디 카드 정보를 불러오지 못했어요.</p> : null}
        {status === "success" && !card ? <p className="text-[13px] text-[#8e8e93]">아직 전달된 코디 카드가 없어요.</p> : null}
        {card ? <DeliveredOutfitCard card={card} /> : null}

        <p className="mt-5 text-[12px] leading-[1.5] text-[#8e8e93]">
          코디 카드는 전달 후 수정할 수 없어요.
          <br />
          이 요청의 임시저장은 삭제됐어요.
        </p>
      </div>
      <PrimaryCta onClick={() => navigate("/influencer/requests")}>요청 목록으로 돌아가기</PrimaryCta>
    </section>
  );
}

/** 전달된 카드를 읽기 전용으로 그린다. 인플루언서와 사용자가 같은 내용을 본다 (I7 / U7과 같은 몸통). */
export function DeliveredOutfitCard({ card }: { card: OutfitCardView }) {
  const members: Array<"self" | "A" | "B"> = card.coachingType === "group" ? ["A", "B"] : ["self"];

  return (
    <div className="flex w-full flex-col gap-4">
      {members.map((memberLabel) => {
        const items = card.items.filter((item) => item.memberLabel === memberLabel);
        const top = items.find((item) => item.itemType === "top");
        const bottom = items.find((item) => item.itemType === "bottom");
        return (
          <div key={memberLabel} className="w-full rounded-[22px] bg-[#f5f5f7] px-5 pb-5 pt-[22px]">
            <div className="flex w-full items-center gap-2">
              <h2 className="text-[20px] font-bold tracking-[-0.4px] text-[#0a0a0a]">{card.title}</h2>
              <div className="flex-1" />
              <Pill>{card.coachingType === "group" ? `구성원 ${memberLabel}` : "읽기 전용"}</Pill>
            </div>
            <p className="mt-1 text-[13px] text-[#8e8e93]">
              {card.influencerName} · {card.budgetLabel} · {card.budgetApproach}
            </p>
            <div className="h-5" />
            <p className="text-[11px] font-semibold text-[#8e8e93]">추천 코디</p>
            <div className="h-[10px]" />
            <div className="flex flex-col gap-[10px]">
              {([["상의", top], ["하의", bottom]] as const).map(([label, item]) => (
                <div key={label} className="flex w-full items-center gap-[14px] rounded-[16px] bg-white p-[14px]">
                  <span className="relative flex h-[76px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-[#f2f2f5]">
                    <img src={iconItemPlaceholder} alt="" className="size-[22px]" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                    <p className="text-[11px] font-semibold text-[#8e8e93]">{label}</p>
                    <p className="text-[15px] font-medium text-[#0a0a0a]">{item?.name ?? "—"}</p>
                    {item ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] font-semibold text-[#3c3c43] underline decoration-[#e8e8ec] underline-offset-2"
                      >
                        {item.url}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-[22px]" />
            <p className="text-[11px] font-semibold text-[#8e8e93]">전하는 말</p>
            <div className="h-[10px]" />
            <div className="w-full rounded-[16px] bg-white p-4">
              <p className="whitespace-pre-wrap text-[15px] leading-[1.52] text-[#0a0a0a]">{card.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
