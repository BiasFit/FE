import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppState } from "../../app/appState";
import type { DiagnosisForm, MatchPriority } from "../../app/types";
import { useAppState } from "../../app/AppStateProvider";
import { budgetRangeLabel, tpoLabel } from "../../data/options";
import { influencers } from "../../data/influencers";
import type {
  MatchExplanation,
  MatchExplanationsRequest,
  StyleDnaExplanationRequest,
} from "../../domain/aiContracts";
import {
  STYLE_NAMES,
  calculateGroupCompatibility,
  calculateStyleScores,
  personalFitDetail,
  styleScoreDetail,
  type PersonalMatchInput,
  type RankMatchInput,
  type RankedInfluencer,
  type StyleScores,
} from "../../domain/scoring";
import { MATCH_PRIORITY_WEIGHTS } from "../../domain/matchPriority";
import type { TestResultPayload } from "../../domain/resultSnapshot";
import {
  getMatchExplanations,
  getTopThree,
  saveTestResult,
} from "../../lib/biasfitApi";
import { FlowShell } from "../../shared/FlowShell";
import { anonUserKey } from "../../storage/anonUser";
import { MatchReason } from "./MatchReason";
import { StyleDnaExplanation } from "./StyleDnaExplanation";

function styleSignalOf(form: DiagnosisForm) {
  return {
    preferredStyle: form.preferredStyle,
    avoidedStyle: form.avoidedStyle,
    keywords: form.keywords,
    designElements: form.designElements,
    preferredItems: form.preferredItems,
    avoidedElements: form.avoidedElements,
  };
}

function scoresFor(form: DiagnosisForm) {
  return calculateStyleScores(styleSignalOf(form));
}

/**
 * 스타일별 항목 내역. `style_score_breakdowns`에 그대로 들어간다.
 * 총점은 `scoresFor`와 같은 계산에서 나오므로 둘이 어긋날 수 없다.
 */
function breakdownsFor(form: DiagnosisForm) {
  const signal = styleSignalOf(form);
  return Object.fromEntries(
    STYLE_NAMES.map((style) => [style, styleScoreDetail(signal, style).breakdowns]),
  );
}

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

/**
 * 화면에 쓴 값을 그대로 모아 저장용 스냅샷을 만든다.
 * 여기서 점수를 다시 계산하거나 AI를 다시 부르지 않는다. 준비가 덜 됐으면 null을 돌려 저장을 미룬다.
 */
function resultSnapshot(
  state: AppState,
  ranked: RankedInfluencer[],
): TestResultPayload | null {
  const priority = state.matchPriority;
  const styleDna = state.styleDna;
  if (!priority || !styleDna || ranked.length === 0) return null;

  const ai = {
    priorityOptions: state.priorityOptions,
    styleDna,
    matchExplanations: state.matchExplanations,
  };
  // 인플루언서 프로필 전체가 아니라 식별자와 점수만 남긴다.
  // 개인은 체형·핏 25점의 내역을 함께 담는다. 그룹은 체형을 점수에 쓰지 않아 없다.
  const rankedInfluencers = ranked.map(
    ({ rank, influencer, baseBreakdown, breakdown }) => ({
      rank,
      influencerId: influencer.id,
      influencerName: influencer.name,
      baseBreakdown,
      breakdown,
      fitDetail:
        state.mode === "personal"
          ? personalFitDetail(
              {
                bodyType: state.personal.bodyType,
                fitConcerns: state.personal.fitConcerns,
              },
              influencer,
            )
          : undefined,
    }),
  );

  if (state.mode === "personal") {
    return {
      mode: "personal",
      priority,
      tpo: state.personal.tpo,
      anonUserKey: anonUserKey(),
      input: { members: [{ memberId: "self", form: state.personal }] },
      ai,
      score: {
        styleScores: [
          {
            memberId: "self",
            scores: scoresFor(state.personal),
            breakdowns: breakdownsFor(state.personal),
          },
        ],
        rankedInfluencers,
      },
    };
  }

  const groupA = scoresFor(state.group.members.A);
  const groupB = scoresFor(state.group.members.B);
  return {
    mode: "group",
    priority,
    tpo: state.group.tpo,
    anonUserKey: anonUserKey(),
    input: {
      members: [
        { memberId: "A", form: state.group.members.A },
        { memberId: "B", form: state.group.members.B },
      ],
      group: {
        relationship: state.group.relationship,
        relationshipOther: state.group.relationshipOther,
      },
    },
    ai,
    score: {
      styleScores: [
        { memberId: "A", scores: groupA, breakdowns: breakdownsFor(state.group.members.A) },
        { memberId: "B", scores: groupB, breakdowns: breakdownsFor(state.group.members.B) },
      ],
      groupCompatibility: calculateGroupCompatibility(
        {
          scores: groupA,
          avoidedStyle: state.group.members.A.avoidedStyle,
          budgetCode: state.group.members.A.budgetCode,
        },
        {
          scores: groupB,
          avoidedStyle: state.group.members.B.avoidedStyle,
          budgetCode: state.group.members.B.budgetCode,
        },
      ),
      rankedInfluencers,
    },
  };
}

export function LoadingDnaScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate("/user/dna"), 850);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return (
    <section className="screen is-active">
      <div className="service-layout">
        <aside className="context-panel">
          <p className="context-brand">BiasFit</p>
          <p className="context-step">STYLE DNA · ANALYZING</p>
          <h2>선택한 기준을 구조화하고 있어요.</h2>
          <p>스타일 선호를 점수로 정리하되 외모를 평가하지 않아요.</p>
        </aside>
        <div className="work-panel">
          <div className="work-body" style={{ textAlign: "center", paddingTop: 120 }}>
            <div className="loading-ring" aria-label="Style DNA 계산 중" />
            <h1 className="page-title" style={{ marginTop: 28 }}>추천 기준을 정리하고 있어요.</h1>
            <p className="page-desc">취향, 핏, 예산과 입을 상황을 함께 살펴보고 있어요.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreBoard({ scores }: { scores: StyleScores }) {
  return (
    <div className="score-board">
      {STYLE_NAMES.map((style) => (
        <div className="score-row" key={style}>
          <span className="score-label">{style}</span>
          <span className="score-track"><span className="score-fill" style={{ width: `${scores[style]}%` }} /></span>
          <strong className="score-value">{scores[style]}</strong>
        </div>
      ))}
    </div>
  );
}

export function DnaScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();
  if (!state.matchPriority) {
    return (
      <FlowShell
        step={3}
        eyebrow="MATCH PRIORITY REQUIRED"
        title={<>매칭 우선순위를<br />먼저 선택해 주세요</>}
        description="Style DNA와 TOP 3는 사용자가 선택한 우선순위로만 계산합니다."
        actions={<button className="btn-primary" type="button" onClick={() => navigate("/user/tpo")}>우선순위 선택으로 돌아가기</button>}
      ><div /></FlowShell>
    );
  }
  const personalScores = scoresFor(state.personal);
  const groupA = scoresFor(state.group.members.A);
  const groupB = scoresFor(state.group.members.B);
  const compatibility = calculateGroupCompatibility(
    { scores: groupA, avoidedStyle: state.group.members.A.avoidedStyle, budgetCode: state.group.members.A.budgetCode },
    { scores: groupB, avoidedStyle: state.group.members.B.avoidedStyle, budgetCode: state.group.members.B.budgetCode },
  );
  const explanationRequest = styleDnaRequest(state, compatibility);

  return (
    <FlowShell
      step={3}
      eyebrow="MY STYLE DNA"
      title={<>나의 Style DNA<br />진단 결과</>}
      description="매칭에 사용하는 구조화된 스타일 기준이에요."
      actions={
        <>
          <button className="btn-secondary" type="button" onClick={() => navigate("/user/body")}>입력 수정</button>
          <button className="btn-primary" type="button" onClick={() => navigate("/user/top3")}>스타일메이트 TOP 3 보기 <span aria-hidden="true">→</span></button>
        </>
      }
    >
      <div className="dna-strip">
        <img src="/assets/biasfit-style-dna-direction-3-strip.png" alt="스타일 무드 참고 이미지" />
      </div>
      <StyleDnaExplanation request={explanationRequest} />
      {state.mode === "personal" ? (
        <>
          <ScoreBoard scores={personalScores} />
          <h2 className="section-title">나의 핵심 기준</h2>
          <div className="criteria-grid">
            <div className="criterion"><div><strong>{state.personal.bodyType}</strong><p>{state.personal.fitConcerns.join(" · ")}</p></div></div>
            <div className="criterion"><div><strong>{state.personal.preferredStyle} / {state.personal.avoidedStyle}</strong><p>선호 / 피하고 싶은 스타일</p></div></div>
            <div className="criterion"><div><strong>{budgetRangeLabel(state.personal.budgetMinCode, state.personal.budgetMaxCode)}</strong><p>{state.personal.budgetApproach}</p></div></div>
            <div className="criterion"><div><strong>{tpoLabel(state.personal.tpo)}</strong><p>지금 필요한 TPO</p></div></div>
          </div>
        </>
      ) : (
        <>
          <div className="group-result-grid">
            <div className="soft-card"><h2 className="sub-title">구성원 A · P4</h2><ScoreBoard scores={groupA} /></div>
            <div className="soft-card"><h2 className="sub-title">구성원 B · P5</h2><ScoreBoard scores={groupB} /></div>
          </div>
          <div className="compatibility">
            <span className="compat-score"><strong>{compatibility.total}</strong></span>
            <div><strong>그룹 스타일 조합도</strong><p>스타일 방향 {compatibility.styleSimilarity}/70 · 예산 조율 {compatibility.budgetCompatibility}/30</p></div>
          </div>
        </>
      )}
    </FlowShell>
  );
}

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
    const controller = new AbortController();
    dispatch({ type: "setMatchExplanationsLoading" });
    void getMatchExplanations(
      explanationRequest(state.mode, input.priority, ranked),
      controller.signal,
    )
      .then(({ explanations }) =>
        dispatch({ type: "setMatchExplanations", explanations }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit AI4] 추천 근거 호출 실패", error);
        dispatch({ type: "setMatchExplanationsError" });
      });
    return () => controller.abort();
  }, [rankedKey, reasonRetry]);

  // 흐름이 끝난 시점에 화면에 쓴 값을 그대로 한 번만 저장한다.
  // 같은 입력으로 다시 렌더링돼도 중복 행이 생기지 않게 저장한 inputKey를 기억한다.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  useEffect(() => {
    if (reasonStatus !== "success" || savedKey === inputKey) return;
    const snapshot = resultSnapshot(state, ranked);
    if (!snapshot) return;
    setSavedKey(inputKey);
    void saveTestResult(snapshot)
      .then(({ id }) => dispatch({ type: "setSavedResultId", id }))
      .catch((error: unknown) => {
        // 저장 실패는 화면 흐름을 막지 않는다. 사용자는 그대로 다음 단계로 간다.
        console.log("[BiasFit 저장] 진단 결과 저장 실패", error);
      });
  }, [inputKey, rankedKey, reasonStatus, savedKey]);

  if (!input || !priority || !weights) {
    return (
      <FlowShell
        step={4}
        eyebrow="MATCH PRIORITY REQUIRED"
        title={<>매칭 우선순위를<br />먼저 선택해 주세요.</>}
        description="선택값 없이 추천 순위나 점수를 계산하지 않습니다."
        actions={<button className="btn-primary" type="button" onClick={() => navigate("/user/tpo")}>우선순위 선택으로 돌아가기</button>}
      ><div /></FlowShell>
    );
  }

  return (
    <FlowShell
      step={4}
      wide
      eyebrow="STYLEMATE TOP 3"
      title={<>나와 잘 맞는 스타일메이트를<br />비교해 보세요.</>}
      description="매칭 적합도는 입력한 취향·핏·예산과 스타일메이트의 강점이 얼마나 맞는지 보여줘요."
      actions={
        <>
          <button className="btn-secondary" type="button" onClick={() => navigate("/user/body")}>조건 수정</button>
          <button className="btn-primary" type="button" disabled={ranked.length === 0 || !state.selectedInfluencerId} onClick={() => navigate("/user/match")}>이 스타일메이트에게 요청하기 <span aria-hidden="true">→</span></button>
        </>
      }
    >
      <details className="disclosure">
        <summary>내 Style DNA 요약</summary>
        <div className="detail-content">
          <p className="helper">
            {state.mode === "personal"
              ? `${state.personal.preferredStyle} · ${state.personal.bodyType} · ${state.personal.fitConcerns.join("/")} · ${tpoLabel(state.personal.tpo)}`
              : `P4 ${state.group.members.A.preferredStyle} + P5 ${state.group.members.B.preferredStyle} · ${tpoLabel(state.group.tpo)}`}
          </p>
        </div>
      </details>
      {rankStatus === "idle" || rankStatus === "loading" ? <div className="soft-card">TOP 3를 계산하고 있어요.</div> : null}
      {rankStatus === "error" ? (
        <div className="soft-card"><p className="error-copy" style={{ display: "block" }}>TOP 3를 불러오지 못했어요.</p><button className="btn-secondary" type="button" onClick={() => setRankRetry((value) => value + 1)}>다시 시도</button></div>
      ) : null}
      {reasonStatus === "error" && ranked.length > 0 ? <button className="btn-secondary" type="button" onClick={() => setReasonRetry((value) => value + 1)}>추천 근거 다시 시도</button> : null}
      <div className="match-grid" style={{ marginTop: 18 }} role="radiogroup" aria-label="스타일메이트 TOP 3">
        {ranked.map(({ influencer, breakdown }, index) => {
          const selected = state.selectedInfluencerId === influencer.id;
          const view = influencers.find((profile) => profile.id === influencer.id)!;
          return (
            <button
              className={`match-card ${selected ? "selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={selected}
              key={influencer.id}
              onClick={() => dispatch({ type: "selectInfluencer", influencerId: influencer.id, score: breakdown.matchScore })}
            >
              <span className="match-photo"><span className="rank">TOP {index + 1}</span></span>
              <span className="match-content">
                <span className="match-top">
                  <span><small>{view.tagline}</small><h3>{influencer.name}</h3></span>
                  <span className="match-score">{breakdown.matchScore}<small>% 매칭</small></span>
                </span>
                <p>{view.description}</p>
                <span className="facts"><span className="fact">◇ {view.price}</span><span className="fact">◇ {view.occasions}</span></span>
                <span className="reason-bars">
                  <span className="reason-bar">스타일 취향 <b>{Math.round(breakdown.style)}/{weights.style}</b><span className="mini-track"><span className="mini-fill" style={{ width: `${(breakdown.style / weights.style) * 100}%` }} /></span></span>
                  <span className="reason-bar">체형·핏 <b>{Math.round(breakdown.fit)}/{weights.fit}</b><span className="mini-track"><span className="mini-fill" style={{ width: `${(breakdown.fit / weights.fit) * 100}%` }} /></span></span>
                  <span className="reason-bar">예산 <b>{Math.round(breakdown.budget)}/{weights.budget}</b><span className="mini-track"><span className="mini-fill" style={{ width: `${(breakdown.budget / weights.budget) * 100}%` }} /></span></span>
                  <span className="reason-bar">{state.mode === "group" ? "공통 TPO" : "TPO"} <b>{Math.round(breakdown.tpo)}/{weights.tpo}</b><span className="mini-track"><span className="mini-fill" style={{ width: `${(breakdown.tpo / weights.tpo) * 100}%` }} /></span></span>
                </span>
                <MatchReason explanation={reasons[influencer.id]} status={reasonStatus} />
              </span>
            </button>
          );
        })}
      </div>
    </FlowShell>
  );
}
