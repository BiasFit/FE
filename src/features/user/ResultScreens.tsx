import { useEffect, useMemo, useRef, useState } from "react";
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
  getInfluencerAvailability,
  getInfluencers,
  getMatchExplanations,
  getStyleDnaExplanation,
  getTopThree,
  trackEvent,
} from "../../lib/biasfitApi.js";
import {
  breakdownsFor,
  buildResultSnapshot,
  completedForms,
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

/** 우선순위를 고르지 않았거나 진단이 덜 찼으면 계산을 시작하지 않는다. */
function rankInput(state: AppState): RankMatchInput | null {
  const priority = state.matchPriority;
  const forms = completedForms(state);
  if (!priority || !forms) return null;
  if (forms.mode === "personal") return personalInput(forms.personal, priority);
  const members = ([forms.members.A, forms.members.B] as const).map((form) => {
    const { mode: _mode, priority: _priority, tpo: _tpo, ...input } =
      personalInput(form, priority);
    return input;
  });
  return {
    mode: "group",
    priority,
    members: [members[0], members[1]],
    tpo: forms.tpo,
  };
}

function styleDnaRequest(
  state: AppState,
  compatibility: ReturnType<typeof calculateGroupCompatibility> | undefined,
): StyleDnaExplanationRequest | null {
  const priority = state.matchPriority;
  const forms = completedForms(state);
  if (!priority || !forms) return null;
  if (forms.mode === "personal") {
    return {
      mode: "personal",
      priority,
      members: [
        {
          memberId: "self",
          form: forms.personal,
          styleScores: scoresFor(forms.personal),
        },
      ],
    };
  }
  return {
    mode: "group",
    priority,
    members: (["A", "B"] as const).map((memberId) => ({
      memberId,
      form: forms.members[memberId],
      styleScores: scoresFor(forms.members[memberId]),
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

  // 덜 채운 진단으로는 점수를 만들지 않는다. 아래에서 진단을 마치라는 화면으로 보낸다.
  const forms = completedForms(state);
  const compatibility =
    forms?.mode === "group"
      ? calculateGroupCompatibility(
          {
            scores: scoresFor(forms.members.A),
            avoidedStyle: forms.members.A.avoidedStyle,
            budgetCode: forms.members.A.budgetCode,
          },
          {
            scores: scoresFor(forms.members.B),
            avoidedStyle: forms.members.B.avoidedStyle,
            budgetCode: forms.members.B.budgetCode,
          },
        )
      : undefined;
  const explanationRequest = styleDnaRequest(state, compatibility);
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

  // KPI: Style DNA 결과 화면 도달 (MEMO/KPI_측정_계획.md).
  //
  // AI 응답이 아니라 **화면에 온 사실**을 남긴다. 응답을 기다렸다가 남기면 AI가 실패했을 때
  // 도달 자체가 세어지지 않아, 정작 문제가 있는 날의 숫자가 비어 버린다.
  // 우선순위 없이 주소로 바로 들어온 경우는 흐름을 통과한 것이 아니므로 세지 않는다.
  const dnaViewTracked = useRef(false);
  useEffect(() => {
    if (dnaViewTracked.current || !state.matchPriority) return;
    dnaViewTracked.current = true;
    trackEvent("style_dna_viewed");
  }, [state.matchPriority]);

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

  // 새로고침으로 세션이 비었을 때처럼 입력이 남아 있지 않은 경우다.
  // 예전에는 여기서 P1 기본값이 그대로 계산돼 남의 진단 결과가 나왔다.
  if (!forms) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[15px] text-[#8e8e93]">진단 입력이 남아 있지 않아요. 처음부터 다시 입력해 주세요.</p>
        <button
          type="button"
          onClick={() => navigate("/user/body")}
          className="rounded-full bg-[#0a0a0a] px-5 py-3 text-[14px] font-semibold text-white"
        >
          진단 다시 하기
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
    forms.mode === "personal"
      ? [forms.personal.preferredStyle, ...forms.personal.keywords]
      : [forms.members.A.preferredStyle, forms.members.B.preferredStyle];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/priority")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        <div className="flex flex-wrap gap-[6px]">
          <Pill tone="dark">{state.mode === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}</Pill>
          <Pill>{tpoLabel(forms.tpo)}</Pill>
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

        {forms.mode === "personal" ? (
          <>
            <div className="mt-9 flex items-center justify-between">
              <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">추구하는 스타일</p>
            </div>
            <div className="h-[16px]" />
            <ScoreBoard scores={scoresFor(forms.personal)} />
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
                <p className="flex-1 text-[15px] text-[#0a0a0a]">{forms.personal.bodyType}</p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">핏 고민</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">{forms.personal.fitConcerns.join(" / ")}</p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">취향</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {forms.personal.preferredStyle} / {forms.personal.avoidedStyle}
                </p>
              </div>
              <div className="flex items-center justify-between py-[14px]">
                <p className="text-[13px] w-24 shrink-0 text-[#8e8e93]">예산과 상황</p>
                <p className="flex-1 text-[15px] text-[#0a0a0a]">
                  {budgetRangeLabel(forms.personal.budgetMinCode, forms.personal.budgetMaxCode)} ·{" "}
                  {forms.personal.budgetApproach}
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
                <ScoreBoard scores={scoresFor(forms.members.A)} />
              </div>
              <div className="rounded-[18px] bg-[#f5f5f7] p-4">
                <p className="text-[15px] font-bold text-[#0a0a0a]">구성원 B</p>
                <div className="h-2" />
                <ScoreBoard scores={scoresFor(forms.members.B)} />
              </div>
            </div>
            {compatibility ? (
              <div className="mt-6 flex items-center gap-4 rounded-[18px] bg-[#f5f5f7] p-5">
                <p className="text-[34px] font-bold tracking-[-1.02px] text-[#0a0a0a]">{compatibility.total}</p>
                <div>
                  <p className="text-[15px] font-bold text-[#0a0a0a]">그룹 스타일 조합도</p>
                  <p className="text-[13px] text-[#8e8e93]">
                    스타일 방향 {compatibility.styleSimilarity}/70 · 예산 조율 {compatibility.budgetCompatibility}/30
                  </p>
                </div>
              </div>
            ) : null}
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
        {/* TOP 3 화면의 "조건 수정 후 다시 추천"과 같은 동작이다. 되돌릴 수 없으니 같이 확인을 받는다. */}
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              "입력을 다시 하면 지금 만든 Style DNA가 사라져요. 계속할까요?",
            );
            if (ok) navigate("/user/body");
          }}
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
                >
                  <div className="flex items-center gap-[14px]">
                    <span
                      className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-[#f2f2f5]"
                      style={influencerPhotoStyle(view?.profileImageUrl)}
                    >
                      {!view?.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
                    </span>
                <div
                  key={influencer.id}
                  className="rounded-[20px] border-[1.6px] border-[#0a0a0a] bg-white p-5 shadow-[0_8px_22px_rgba(0,0,0,0.07)]"
                >
                  <div className="flex items-center gap-[14px]">
                    <InfluencerPhotoButton
                      name={influencer.name}
                      photoUrl={view?.profileImageUrl}
                      size="large"
                      onOpen={() => {
                        const url = view?.profileImageUrl;
                        if (url) setPhotoPreview({ name: influencer.name, url });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Pill tone="dark">TOP {index + 1}</Pill>
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
            return (
              <div
                key={influencer.id}
                className="flex items-center gap-[14px] rounded-[18px] bg-[#f5f5f7] px-[18px] py-4"
              >
                <InfluencerPhotoButton
                  name={influencer.name}
                  photoUrl={view?.profileImageUrl}
                  size="small"
                  onOpen={() => {
                    const url = view?.profileImageUrl;
                    if (url) setPhotoPreview({ name: influencer.name, url });
                  }}
                />
                <button
                  type="button"
                  onClick={select}
                  aria-label={`TOP ${index + 1} ${influencer.name} 후보 선택`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
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
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-[13px] leading-[1.5] text-[#8e8e93]">
          className="mt-8 self-start text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          조건 수정 후 다시 추천
        </button>
      </div>
    </section>
        </button>
      </div>
      <PhotoPreviewDialog preview={photoPreview} onClose={() => setPhotoPreview(null)} />
    </section>
  );
}
