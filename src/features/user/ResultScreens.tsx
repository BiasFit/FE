import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppState } from "../../app/appState.js";
import type { AiRequestStatus, DiagnosisForm, MatchPriority } from "../../app/types.js";
import { useAppState } from "../../app/AppStateProvider.js";
import { budgetRangeLabel, tpoLabel } from "../../data/options.js";
import type {
  MatchExplanation,
  MatchExplanationsRequest,
  StyleDnaExplanationRequest,
} from "../../domain/aiContracts.js";
import {
  STYLE_NAMES,
  calculateGroupCompatibility,
  type PersonalMatchInput,
  type RankMatchInput,
  type RankedInfluencer,
  type StyleScores,
} from "../../domain/scoring.js";
import { MATCH_PRIORITY_WEIGHTS } from "../../domain/matchPriority.js";
import {
  getInfluencers,
  getMatchExplanations,
  getStyleDnaExplanation,
  getTopThree,
} from "../../lib/biasfitApi.js";
import {
  breakdownsFor,
  buildResultSnapshot,
  saveDiagnosisOnce,
  scoresFor,
} from "./diagnosisSnapshot.js";
import { influencerPhotoStyle } from "../../shared/influencerPhoto.js";
import { Pill, PrimaryCta, TopBar } from "../../shared/AppShell.js";
import { MatchReason } from "./MatchReason.js";
import iconChevronDown from "../../assets/mypage/icon-chevron-down.svg";
import iconAvatar from "../../assets/mypage/icon-avatar.svg";

function personalInput(
  form: DiagnosisForm,
  priority: MatchPriority,
): PersonalMatchInput & { priority: MatchPriority } {
  return {
    mode: "personal",
    priority,
    styleScores: scoresFor(form),
    avoidedStyle: form.avoidedStyle,
    bodyType: form.bodyType,
    fitConcerns: form.fitConcerns,
    budgetMinCode: form.budgetMinCode,
    budgetMaxCode: form.budgetMaxCode,
    budgetApproach: form.budgetApproach,
    tpo: form.tpo,
  };
}

function rankInput(state: AppState): RankMatchInput {
  const priority = state.matchPriority;
  if (!priority) throw new Error("매칭 우선순위 선택이 필요합니다.");
  if (state.mode === "personal") return personalInput(state.personal, priority);
  const members = (["A", "B"] as const).map((member) => {
    const { mode: _mode, priority: _priority, tpo: _tpo, ...input } =
      personalInput(state.group.members[member], priority);
    return input;
  });
  return {
    mode: "group",
    priority,
    members: [members[0], members[1]],
    tpo: state.group.tpo,
  };
}

function styleDnaRequest(
  state: AppState,
  compatibility: ReturnType<typeof calculateGroupCompatibility>,
): StyleDnaExplanationRequest {
  const priority = state.matchPriority;
  if (!priority) throw new Error("매칭 우선순위 선택이 필요합니다.");
  if (state.mode === "personal") {
    return {
      mode: "personal",
      priority,
      members: [
        {
          memberId: "self",
          form: state.personal,
          styleScores: scoresFor(state.personal),
        },
      ],
    };
  }
  return {
    mode: "group",
    priority,
    members: (["A", "B"] as const).map((memberId) => ({
      memberId,
      form: state.group.members[memberId],
      styleScores: scoresFor(state.group.members[memberId]),
    })),
    groupCompatibility: compatibility,
  };
}

const LOADING_STEPS = [
  "체형과 핏 정보를 확인하는 중",
  "취향 데이터를 정리하는 중",
  "예산과 상황을 맞춰보는 중",
  "Style DNA를 정리하는 중",
];

const LOADING_AURORA_BLOBS = [
  { size: 460, left: -140, top: 120, color: "124,77,255", opacity: 0.5, delay: "0s" },
  { size: 460, left: 150, top: 60, color: "79,141,255", opacity: 0.38, delay: "-4s" },
  { size: 420, left: -40, top: 220, color: "180,156,255", opacity: 0.4, delay: "-8s" },
  { size: 400, left: 180, top: 320, color: "240,194,255", opacity: 0.34, delay: "-12s" },
  { size: 380, left: -110, top: 400, color: "143,220,255", opacity: 0.24, delay: "-16s" },
];

/** 사용자가 준 로딩 데모(biasfit-loading-demo.html)를 그대로 옮긴 애니메이션. 타이머로
 * 자동 진행하는 방식은 그대로 두고(2026-08-16 요청), 화면만 이 애니메이션으로 바꿨다. */
export function LoadingDnaScreen() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let fadeTimer: number | undefined;
    const navigateTimer = window.setTimeout(() => navigate("/user/dna"), 2400);
    const cycleTimer = window.setInterval(() => {
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        setStepIndex((current) => (current + 1) % LOADING_STEPS.length);
        setFading(false);
      }, 350);
    }, 2200);
    return () => {
      window.clearTimeout(navigateTimer);
      window.clearInterval(cycleTimer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [navigate]);

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center overflow-hidden bg-white px-8 text-center">
      <div className="aurora-blobs" aria-hidden="true">
        {LOADING_AURORA_BLOBS.map((blob, index) => (
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
            "linear-gradient(to bottom, rgba(255,255,255,.9), rgba(255,255,255,.35) 42%, rgba(255,255,255,.9))",
        }}
        aria-hidden="true"
      />
      <main role="status" aria-live="polite" className="relative z-[1] flex flex-col items-center">
        <div className="loading-orb" aria-hidden="true">
          <svg viewBox="0 0 140 140" className="orb-ring-out" fill="none">
            <circle cx="70" cy="70" r="64" stroke="#0A0A0A" strokeOpacity=".08" strokeWidth="1.5" />
            <path d="M70 6a64 64 0 0 1 58.7 38.6" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 140 140" className="orb-ring-mid" fill="none">
            <circle cx="70" cy="70" r="48" stroke="#0A0A0A" strokeOpacity=".07" strokeWidth="1.5" />
            <path d="M22 70a48 48 0 0 1 25.9-43.6" stroke="#7C4DFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 140 140" fill="none">
            <circle cx="70" cy="70" r="32" stroke="#0A0A0A" strokeOpacity=".06" strokeWidth="1.5" />
          </svg>
          <svg viewBox="0 0 140 140" fill="none">
            <circle cx="70" cy="70" r="7" fill="#0A0A0A" className="orb-core" />
          </svg>
        </div>

        <h1 className="m-0 mt-11 text-[23px] font-bold leading-[1.4] tracking-[-0.03em] text-[#0a0a0a]">
          최신의 Style DNA를
          <br />
          생성하고 있어요
        </h1>
        <p className="mt-[14px] text-[13px] font-medium leading-[1.6] text-[#8e8e93]">
          입력하신 체형·취향·예산·상황을 분석하는 중이에요.
          <br />
          잠시만 기다려 주세요.
        </p>

        <div className="loading-track mt-10" aria-hidden="true">
          <div className="bar" />
        </div>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white bg-white/75 px-[14px] py-[9px] backdrop-blur-sm">
          <span className="loading-step-dot" aria-hidden="true" />
          <span className={`loading-step-text text-[11px] font-semibold text-[#3c3c43] ${fading ? "out" : ""}`}>
            {LOADING_STEPS[stepIndex]}
          </span>
        </div>
      </main>
    </section>
  );
}

function ReasonBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px] text-[#3c3c43]">
        <span>{label}</span>
        <span className="font-semibold text-[#0a0a0a]">
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-[#eff1f7]">
        <div className="h-full rounded-full bg-[#0a0a0a]" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * 예전 `.score-board`/`.score-row`(고정 180px 라벨 칼럼) CSS는 원래 넓은 1단 레이아웃
 * 기준이라, 그룹 모드의 좁은 2단 카드(`grid-cols-2`) 안에 넣으면 숫자가 카드 밖으로
 * 밀려났다 (2026-08-16 스크린샷). 폭이 얼마든 안 깨지게 Tailwind로 다시 짰다 —
 * A7(마이페이지 진단 상세)의 "라벨+점수, 아래 얇은 막대" 구성과 같다.
 */
function ScoreBoard({ scores }: { scores: StyleScores }) {
  return (
    <div className="flex w-full flex-col gap-3">
      {STYLE_NAMES.map((style) => (
        <div key={style} className="flex w-full min-w-0 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] text-[#3c3c43]">{style}</span>
            <span className="shrink-0 text-[13px] font-bold text-[#0a0a0a]">{scores[style]}</span>
          </div>
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#eff1f7]">
            <div className="h-full rounded-full bg-[#0a0a0a]" style={{ width: `${scores[style]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * U4 · 스타일 진단 결과. 피그마는 개인 모드만 그려져 있어서, 그룹 모드는
 * 같은 톤(v3 검정/화이트)을 유지하되 화면 구성은 예전 것을 살려서 새로 짰다.
 * `StyleDnaExplanation` 컴포넌트를 쓰던 걸 이 화면 안으로 옮겼다 — 요약 문구는
 * 큰 제목으로, 매칭 포인트는 "스타일링 기준" 박스로 각각 다른 자리에 써야 해서다.
 */
export function DnaScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const [retry, setRetry] = useState(0);

  const personalScores = scoresFor(state.personal);
  const groupA = scoresFor(state.group.members.A);
  const groupB = scoresFor(state.group.members.B);
  const compatibility = calculateGroupCompatibility(
    { scores: groupA, avoidedStyle: state.group.members.A.avoidedStyle, budgetCode: state.group.members.A.budgetCode },
    { scores: groupB, avoidedStyle: state.group.members.B.avoidedStyle, budgetCode: state.group.members.B.budgetCode },
  );
  const explanationRequest = state.matchPriority ? styleDnaRequest(state, compatibility) : null;
  const requestKey = JSON.stringify(explanationRequest);

  useEffect(() => {
    if (!explanationRequest) return;
    const controller = new AbortController();
    dispatch({ type: "setStyleDnaLoading" });
    void getStyleDnaExplanation(explanationRequest, controller.signal)
      .then((response) => dispatch({ type: "setStyleDna", result: response }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit AI2] Style DNA 설명 호출 실패", error);
        dispatch({ type: "setStyleDnaError" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, requestKey, retry]);

  if (!state.matchPriority) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[15px] text-[#8e8e93]">Style DNA와 TOP 3는 사용자가 선택한 우선순위로만 계산해요.</p>
        <button
          type="button"
          onClick={() => navigate("/user/priority")}
          className="rounded-full bg-[#0a0a0a] px-5 py-3 text-[14px] font-semibold text-white"
        >
          우선순위 선택으로 돌아가기
        </button>
      </section>
    );
  }

  const result = state.styleDna;
  const status = state.styleDnaStatus;
  const canOpenTop3 = status === "success" && result !== null;
  const summary =
    result?.mode === "personal"
      ? result.personalStyleDnaSummary
      : result?.mode === "group"
        ? result.groupStyleDnaSummary
        : null;
  const matchingPoints =
    result?.mode === "personal"
      ? result.personalMatchingPoints
      : result?.mode === "group"
        ? result.groupMatchingPoints
        : [];
  const hashtags =
    state.mode === "personal"
      ? [state.personal.preferredStyle, ...state.personal.keywords]
      : [state.group.members.A.preferredStyle, state.group.members.B.preferredStyle];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/priority")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        <div className="flex flex-wrap gap-[6px]">
          <Pill tone="dark">{state.mode === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}</Pill>
          <Pill>{tpoLabel(state.mode === "group" ? state.group.tpo : state.personal.tpo)}</Pill>
        </div>
        <div className="h-[18px]" />
        {status === "loading" || status === "idle" ? (
          <p className="text-[15px] text-[#8e8e93]">Style DNA 설명을 만들고 있어요.</p>
        ) : status === "error" || !summary ? (
          <div>
            <p className="text-[13px] text-[#8e8e93]">설명을 불러오지 못했어요. 계산된 점수는 유지돼요.</p>
            <button
              type="button"
              onClick={() => setRetry((v) => v + 1)}
              className="mt-2 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">{summary}</h1>
        )}
        <div className="h-3" />
        <div className="flex flex-wrap gap-[6px]">
          {hashtags.map((tag) => (
            <Pill key={tag}>#{tag}</Pill>
          ))}
        </div>

        {state.mode === "personal" ? (
          <>
            <div className="mt-9 flex items-center justify-between">
              <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">추구하는 스타일</p>
            </div>
            <div className="h-[16px]" />
            <ScoreBoard scores={personalScores} />
            <div className="h-3" />
            <p className="text-[13px] text-[#8e8e93]">입력한 내용이 어떤 스타일에 가까운지를 보여주는 값이에요.</p>

            <div className="mt-9 rounded-[18px] bg-[#f5f5f7] p-5">
              <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">스타일링 기준</p>
              <div className="h-[14px]" />
              <div className="flex flex-col gap-[10px] text-[13px] leading-[1.5] text-[#3c3c43]">
                {matchingPoints.length > 0 ? (
                  matchingPoints.map((point) => <p key={point.text}>· {point.text}</p>)
                ) : (
                  <p>기준을 정리하는 중이에요.</p>
                )}
              </div>
            </div>

            <div className="mt-9 flex flex-col divide-y divide-[#e8e8ec]">
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">체형 유형</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">{state.personal.bodyType}</p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">핏 고민</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">{state.personal.fitConcerns.join(" / ")}</p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">취향</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {state.personal.preferredStyle} / {state.personal.avoidedStyle}
                </p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">예산과 상황</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {budgetRangeLabel(state.personal.budgetMinCode, state.personal.budgetMaxCode)} ·{" "}
                  {state.personal.budgetApproach}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-9 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-[#f5f5f7] p-4">
                <p className="text-[15px] font-bold text-[#0a0a0a]">구성원 A</p>
                <div className="h-2" />
                <ScoreBoard scores={groupA} />
              </div>
              <div className="rounded-[18px] bg-[#f5f5f7] p-4">
                <p className="text-[15px] font-bold text-[#0a0a0a]">구성원 B</p>
                <div className="h-2" />
                <ScoreBoard scores={groupB} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4 rounded-[18px] bg-[#f5f5f7] p-5">
              <p className="text-[34px] font-bold tracking-[-1.02px] text-[#0a0a0a]">{compatibility.total}</p>
              <div>
                <p className="text-[15px] font-bold text-[#0a0a0a]">그룹 스타일 조합도</p>
                <p className="text-[13px] text-[#8e8e93]">
                  스타일 방향 {compatibility.styleSimilarity}/70 · 예산 조율 {compatibility.budgetCompatibility}/30
                </p>
              </div>
            </div>
            <div className="mt-9 rounded-[18px] bg-[#f5f5f7] p-5">
              <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">스타일링 기준</p>
              <div className="h-[14px]" />
              <div className="flex flex-col gap-[10px] text-[13px] leading-[1.5] text-[#3c3c43]">
                {matchingPoints.length > 0 ? (
                  matchingPoints.map((point) => <p key={point.text}>· {point.text}</p>)
                ) : (
                  <p>기준을 정리하는 중이에요.</p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="h-9" />
        <button
          type="button"
          onClick={() => navigate("/user/body")}
          className="text-left text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          입력 수정하기
        </button>
      </div>
      <PrimaryCta
        disabled={!canOpenTop3}
        onClick={() => {
          if (!canOpenTop3) return;
          navigate("/user/top3");
        }}
      >
        {status === "loading" || status === "idle" ? "Style DNA 준비 중" : "TOP 3 보기"}
      </PrimaryCta>
    </section>
  );
}

/**
 * 가장 최근에 시작한 추천 근거 요청. 화면이 사라져도 남아야 해서 모듈 수준에 둔다.
 * 늦게 도착한 응답이 아직 유효한지는 **오직 이 값으로만** 판단한다.
 */
let latestExplanationRequest: object | null = null;

function explanationRequest(
  mode: AppState["mode"],
  priority: MatchPriority,
  ranked: RankedInfluencer[],
): MatchExplanationsRequest {
  return {
    mode,
    priority,
    rankedInfluencers: ranked.map(({ influencer, rank, breakdown, matchedEvidence }) => ({
      influencerId: influencer.id,
      rank,
      matchScore: breakdown.matchScore,
      breakdown,
      matchedEvidence,
    })),
  };
}

export function Top3Screen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const input = useMemo(
    () => (state.matchPriority ? rankInput(state) : null),
    [state],
  );
  const inputKey = JSON.stringify(input);
  // 순위와 추천 근거는 전역 state에 둔다. 저장 시점에 이 값들이 필요하다.
  const ranked = state.rankedInfluencers;
  const rankStatus = state.rankStatus;
  const reasonStatus = state.matchExplanationStatus;
  const [rankRetry, setRankRetry] = useState(0);
  const [reasonRetry, setReasonRetry] = useState(0);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AiRequestStatus>(
    state.savedResultId ? "success" : "idle",
  );
  const canSelectInfluencer = Boolean(state.savedResultId);
  const reasons = useMemo(
    () =>
      Object.fromEntries(
        state.matchExplanations.map((reason) => [reason.influencerId, reason]),
      ) as Record<string, MatchExplanation>,
    [state.matchExplanations],
  );
  const priority = input?.priority;
  const weights = priority ? MATCH_PRIORITY_WEIGHTS[state.mode][priority] : null;

  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    dispatch({ type: "setRankingLoading" });
    void getTopThree(input, controller.signal)
      .then(({ rankedInfluencers }) =>
        dispatch({ type: "setRankedInfluencers", ranked: rankedInfluencers }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        dispatch({ type: "setRankingError" });
      });
    return () => controller.abort();
  }, [inputKey, rankRetry]);

  const rankedKey = JSON.stringify(ranked);
  useEffect(() => {
    if (!input || ranked.length === 0) return;

    // ⚠️ 이 요청은 화면을 떠나도 **취소하지 않는다.**
    // 취소하면 근거가 영영 도착하지 않고, 근거 뒤에 이어 붙인 저장까지 함께 사라진다.
    // 그래서 사용자는 다섯 단계 뒤 부탁해요 카드에서야 막혔다
    // (MEMO/진단결과_저장_실패_사건_스터디.md).
    // 대신 더 새 진단이 시작되면 옛 응답을 버려서 화면이 뒤바뀌지 않게 한다.
    const token = {};
    latestExplanationRequest = token;
    dispatch({ type: "setMatchExplanationsLoading" });
    void getMatchExplanations(explanationRequest(state.mode, input.priority, ranked))
      .then(({ explanations }) => {
        if (latestExplanationRequest !== token) return;
        dispatch({ type: "setMatchExplanations", explanations });
        // 저장을 같은 약속(promise)에 이어 붙인다. 화면 수명과 무관하게 끝까지 간다.
        persistResult(explanations);
      })
      .catch((error: unknown) => {
        if (latestExplanationRequest !== token) return;
        console.log("[BiasFit AI4] 추천 근거 호출 실패", error);
        dispatch({ type: "setMatchExplanationsError" });
        // 근거 없이는 저장하지 않는다. 이때는 부탁해요 카드를 보내는 시점에 저장한다.
      });
  }, [rankedKey, reasonRetry]);

  /**
   * 화면에 쓴 값을 그대로 저장한다.
   * 실패해도 흐름을 막지 않는다 — 부탁해요 카드를 보낼 때 한 번 더 시도하고, 그때는 사용자에게 알린다.
   */
  function persistResult(explanations: MatchExplanation[]) {
    const snapshot = buildResultSnapshot({ ...state, matchExplanations: explanations }, ranked);
    if (!snapshot) {
      setSaveStatus("error");
      console.log("[BiasFit 저장] 진단 스냅샷 준비 안 됨", {
        hasPriority: Boolean(state.matchPriority),
        hasStyleDna: Boolean(state.styleDna),
        rankedCount: ranked.length,
      });
      return;
    }
    setSaveStatus("loading");
    void saveDiagnosisOnce(snapshot)
      .then(({ id }) => {
        dispatch({ type: "setSavedResultId", id });
        setSaveStatus("success");
      })
      .catch((error: unknown) => {
        console.log("[BiasFit 저장] 진단 결과 저장 실패", error);
        setSaveStatus("error");
      });
  }

  // 카드 표시용 스타일메이트 목록. 한 번만 받아 appState에 둔다.
  // 우선순위를 고르기 전에는 어떤 API도 부르지 않는다 (PLAN.MD 1부 규칙).
  const directoryLoaded = state.influencerDirectory.length > 0;
  useEffect(() => {
    if (!input || directoryLoaded) return;
    const controller = new AbortController();
    void getInfluencers(controller.signal)
      .then(({ influencers }) =>
        dispatch({ type: "setInfluencerDirectory", influencers }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 매칭] 스타일메이트 목록 호출 실패", error);
      });
    return () => controller.abort();
  }, [directoryLoaded]);

  if (!input || !priority || !weights) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[15px] text-[#8e8e93]">선택값 없이 추천 순위나 점수를 계산하지 않습니다.</p>
        <button
          type="button"
          onClick={() => navigate("/user/priority")}
          className="rounded-full bg-[#0a0a0a] px-5 py-3 text-[14px] font-semibold text-white"
        >
          우선순위 선택으로 돌아가기
        </button>
      </section>
    );
  }

  const currentTpo = tpoLabel(state.mode === "group" ? state.group.tpo : state.personal.tpo);
  // 사용자가 직접 고르기 전에는 1위 후보를 큰 카드로 미리 보여준다.
  const bigId = state.selectedInfluencerId || ranked[0]?.influencer.id;

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/priority")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          스타일링을 받고 싶은
          <br />
          인플루언서를 선택해 주세요.
        </h1>
        <p className="mt-[10px] text-[15px] text-[#8e8e93]">내 Style DNA와 가장 잘 맞는 3명이에요.</p>

        <div className="mt-7 flex flex-col gap-[10px]" role="radiogroup" aria-label="스타일메이트 TOP 3">
          {rankStatus === "idle" || rankStatus === "loading" ? (
            <p className="text-[13px] text-[#8e8e93]">Style DNA와 잘 맞는 인플루언서를 찾는 중이에요.</p>
          ) : null}
          {rankStatus === "success" && ranked.length === 0 ? (
            // 후보가 0명이 되는 경우가 실제로 있다. 수신 한도에 찬 인플루언서는 후보에서 빠진다.
            // **남은 자리 수나 수신 수는 절대 보여주지 않는다** (Design_system-2.md 179행).
            <div className="rounded-[18px] bg-[#f5f5f7] p-5" aria-live="polite">
              <p className="text-[15px] text-[#0a0a0a]">현재 요청을 더 받을 수 있는 스타일메이트가 없어요.</p>
              <p className="mt-1 text-[13px] text-[#8e8e93]">잠시 후 다시 확인해 주세요.</p>
              <button
                type="button"
                onClick={() => setRankRetry((value) => value + 1)}
                className="mt-3 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
              >
                다시 추천
              </button>
            </div>
          ) : null}
          {rankStatus === "error" ? (
            <div className="rounded-[18px] bg-[#f5f5f7] p-5">
              <p className="text-[13px] text-[#8e8e93]">TOP 3를 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={() => setRankRetry((value) => value + 1)}
                className="mt-2 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          {reasonStatus === "error" && ranked.length > 0 ? (
            <button
              type="button"
              onClick={() => setReasonRetry((value) => value + 1)}
              className="self-start rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
            >
              추천 근거 다시 시도
            </button>
          ) : null}
          {ranked.length > 0 && !canSelectInfluencer && reasonStatus !== "error" ? (
            <div className="rounded-[18px] bg-[#f5f5f7] p-4" aria-live="polite">
              {saveStatus === "error" ? (
                <>
                  <p className="text-[13px] text-[#3c3c43]">진단 결과 저장에 실패했어요.</p>
                  <button
                    type="button"
                    onClick={() => persistResult(state.matchExplanations)}
                    className="mt-2 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
                  >
                    저장 다시 시도
                  </button>
                </>
              ) : (
                <p className="text-[13px] text-[#8e8e93]">진단 결과를 안전하게 저장하고 있어요.</p>
              )}
            </div>
          ) : null}

          {ranked.map(({ influencer, breakdown }, index) => {
            const view = state.influencerDirectory.find((profile) => profile.id === influencer.id);
            const select = () =>
              dispatch({ type: "selectInfluencer", influencerId: influencer.id, score: breakdown.matchScore });

            if (influencer.id === bigId) {
              return (
                <div
                  key={influencer.id}
                  role="radio"
                  aria-checked="true"
                  className="rounded-[20px] border-[1.6px] border-[#0a0a0a] bg-white p-5 shadow-[0_8px_22px_rgba(0,0,0,0.07)]"
                >
                  <div className="flex items-center gap-[14px]">
                    <span
                      className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f2f2f5]"
                      style={influencerPhotoStyle(view?.profileImageUrl)}
                    >
                      {!view?.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Pill tone="dark">TOP {index + 1}</Pill>
                        <p className="truncate text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">
                          {influencer.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-[#8e8e93]">
                        {view?.tagline} · {currentTpo}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-[13px] text-[#8e8e93]">매칭 적합도</p>
                      <p className="text-[11px] font-semibold text-[#8e8e93]">100점 환산 점수</p>
                    </div>
                    <p className="text-[34px] font-bold tracking-[-1.02px] text-[#0a0a0a]">{breakdown.matchScore}</p>
                  </div>
                  <p className="mt-[18px] text-[15px] leading-[1.52] text-[#3c3c43]">{view?.description}</p>
                  <div className="mt-[18px] text-[13px] leading-[1.5] text-[#3c3c43]">
                    <MatchReason explanation={reasons[influencer.id]} status={reasonStatus} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setReasonsOpen((v) => !v)}
                    className="mt-[10px] flex w-full items-center gap-2 border-t border-[#e8e8ec] py-4 text-[13px] font-medium text-[#3c3c43]"
                  >
                    근거 자세히 보기
                    <span className="flex-1" />
                    <img
                      src={iconChevronDown}
                      alt=""
                      className={`size-5 transition-transform ${reasonsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {reasonsOpen ? (
                    <div className="flex flex-col gap-3 pb-4">
                      <ReasonBar label="스타일 취향" value={breakdown.style} max={weights.style} />
                      <ReasonBar label="체형·핏" value={breakdown.fit} max={weights.fit} />
                      <ReasonBar label="예산" value={breakdown.budget} max={weights.budget} />
                      <ReasonBar
                        label={state.mode === "group" ? "공통 TPO" : "TPO"}
                        value={breakdown.tpo}
                        max={weights.tpo}
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canSelectInfluencer}
                    onClick={() => {
                      if (!canSelectInfluencer) return;
                      select();
                      navigate("/user/match");
                    }}
                    className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-40"
                  >
                    {canSelectInfluencer ? "선택하기" : "진단 결과 저장 중"}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={influencer.id}
                type="button"
                role="radio"
                aria-checked="false"
                onClick={select}
                className="flex items-center gap-[14px] rounded-[18px] bg-[#f5f5f7] px-[18px] py-4 text-left"
              >
                <span
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f2f2f5]"
                  style={influencerPhotoStyle(view?.profileImageUrl)}
                >
                  {!view?.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="shrink-0 text-[11px] text-[#8e8e93]">TOP {index + 1}</p>
                    <p className="truncate text-[16px] font-semibold text-[#0a0a0a]">{influencer.name}</p>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[#8e8e93]">
                    {view?.tagline} · {currentTpo}
                  </p>
                  <span className="sr-only">
                    <MatchReason explanation={reasons[influencer.id]} status={reasonStatus} />
                  </span>
                </div>
                <p className="shrink-0 text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">
                  {breakdown.matchScore}
                </p>
                <img src={iconChevronDown} alt="" className="size-5 shrink-0 -rotate-90" />
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-[13px] leading-[1.5] text-[#8e8e93]">
          점수는 나의 스타일 기준과 요청 조건이 인플루언서와 얼마나 잘 맞는지를 보여줘요.
        </p>
      </div>
      <div className="px-5 pb-[10px] pt-[10px]">
        <button
          type="button"
          onClick={() => navigate("/user/body")}
          className="flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[#e8e8ec] bg-white text-[15px] font-bold text-[#3c3c43]"
        >
          조건 수정 후 다시 추천
        </button>
      </div>
    </section>
  );
}
