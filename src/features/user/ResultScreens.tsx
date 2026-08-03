import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { AppState } from "../../app/appState";
import type { DiagnosisForm } from "../../app/types";
import { useAppState } from "../../app/AppStateProvider";
import { budgetRangeLabel } from "../../data/options";
import { influencers } from "../../data/influencers";
import {
  STYLE_NAMES,
  calculateGroupCompatibility,
  calculateStyleScores,
  rankInfluencers,
  type PersonalMatchInput,
  type RankMatchInput,
  type StyleScores,
} from "../../domain/scoring";
import { FlowShell } from "../../shared/FlowShell";

function scoresFor(form: DiagnosisForm) {
  return calculateStyleScores({
    preferredStyle: form.preferredStyle,
    avoidedStyle: form.avoidedStyle,
    keywords: form.keywords,
    designElements: form.designElements,
    preferredItems: form.preferredItems,
    avoidedElements: form.avoidedElements,
  });
}

function personalInput(form: DiagnosisForm): PersonalMatchInput {
  return {
    mode: "personal",
    styleScores: scoresFor(form),
    avoidedStyle: form.avoidedStyle,
    bodyType: form.bodyType,
    fitConcerns: form.fitConcerns,
    budgetCode: form.budgetCode,
    budgetApproach: form.budgetApproach,
    tpo: form.tpo,
  };
}

function rankInput(state: AppState): RankMatchInput {
  if (state.mode === "personal") return personalInput(state.personal);
  const members = (["A", "B"] as const).map((member) => {
    const form = state.group.members[member];
    const { mode: _mode, tpo: _tpo, ...input } = personalInput(form);
    return input;
  });
  return { mode: "group", members: [members[0], members[1]], tpo: state.group.tpo };
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
            <h1 className="page-title" style={{ marginTop: 28 }}>
              추천 기준을 정리하고 있어요.
            </h1>
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
          <span className="score-track">
            <span className="score-fill" style={{ width: `${scores[style]}%` }} />
          </span>
          <strong className="score-value">{scores[style]}</strong>
        </div>
      ))}
    </div>
  );
}

export function DnaScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const personalScores = scoresFor(state.personal);
  const groupA = scoresFor(state.group.members.A);
  const groupB = scoresFor(state.group.members.B);
  const compatibility = calculateGroupCompatibility(
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
  );

  return (
    <FlowShell
      step={3}
      eyebrow="MY STYLE DNA"
      title={
        state.mode === "personal" ? (
          <>
            부드럽고 단정한
            <br />
            캠퍼스 밸런스
          </>
        ) : (
          <>
            서로 다른 취향을 잇는
            <br />
            여행 시밀러 밸런스
          </>
        )
      }
      description="매칭에 사용하는 구조화된 스타일 기준이에요."
      actions={
        <>
          <button className="btn-secondary" type="button" onClick={() => navigate("/user/body")}>
            입력 수정
          </button>
          <button className="btn-primary" type="button" onClick={() => navigate("/user/top3")}>
            스타일메이트 TOP 3 보기 <span aria-hidden="true">→</span>
          </button>
        </>
      }
    >
      <div className="dna-strip">
        <img src="/assets/biasfit-style-dna-direction-3-strip.png" alt="로맨틱, 캐주얼, 단정한 캠퍼스 스타일 무드" />
      </div>
      {state.mode === "personal" ? (
        <>
          <ScoreBoard scores={personalScores} />
          <h2 className="section-title">나의 핵심 기준</h2>
          <div className="criteria-grid">
            <div className="criterion"><div><strong>{state.personal.bodyType}</strong><p>{state.personal.fitConcerns.join(" · ")}</p></div></div>
            <div className="criterion"><div><strong>{state.personal.preferredStyle} / {state.personal.avoidedStyle}</strong><p>선호 / 피하고 싶은 스타일</p></div></div>
            <div className="criterion"><div><strong>{budgetRangeLabel(state.personal.budgetMinCode, state.personal.budgetMaxCode)}</strong><p>{state.personal.budgetApproach}</p></div></div>
            <div className="criterion"><div><strong>{state.personal.tpo}</strong><p>지금 필요한 TPO</p></div></div>
          </div>
          <details className="disclosure">
            <summary>선택한 취향 상세 보기</summary>
            <div className="detail-content">
              <div className="detail-row"><strong>선호 키워드</strong><p className="helper">{state.personal.keywords.join(" · ")}</p></div>
              <div className="detail-row"><strong>선호 디자인·아이템</strong><p className="helper">{state.personal.designElements.join(", ")} · {state.personal.preferredItems.join(", ")}</p></div>
              <div className="detail-row"><strong>매칭에 중요한 포인트</strong><p className="helper">하의 길이와 전체 비율을 잘 다루고, 개강 TPO를 가성비 중심으로 제안하는 스타일메이트를 우선해요.</p></div>
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="group-result-grid">
            <div className="soft-card">
              <h2 className="sub-title">구성원 A · P4</h2>
              <ScoreBoard scores={groupA} />
            </div>
            <div className="soft-card">
              <h2 className="sub-title">구성원 B · P5</h2>
              <ScoreBoard scores={groupB} />
            </div>
          </div>
          <div className="compatibility">
            <span className="compat-score"><strong>{compatibility.total}</strong></span>
            <div>
              <strong>그룹 스타일 조합도</strong>
              <p>
                스타일 방향 {compatibility.styleSimilarity}/70 · 예산 조율{" "}
                {compatibility.budgetCompatibility}/30
              </p>
            </div>
          </div>
        </>
      )}
    </FlowShell>
  );
}

export function Top3Screen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const ranked = rankInfluencers(rankInput(state), influencers);

  return (
    <FlowShell
      step={4}
      wide
      eyebrow="STYLEMATE TOP 3"
      title={
        <>
          나와 잘 맞는 스타일메이트를
          <br />
          비교해 보세요.
        </>
      }
      description="매칭 적합도는 입력한 취향·핏·예산과 스타일메이트의 강점이 얼마나 맞는지 보여줘요."
      actions={
        <>
          <button className="btn-secondary" type="button" onClick={() => navigate("/user/body")}>
            조건 수정
          </button>
          <button className="btn-primary" type="button" onClick={() => navigate("/user/match")}>
            이 스타일메이트에게 요청하기 <span aria-hidden="true">→</span>
          </button>
        </>
      }
    >
      <details className="disclosure">
        <summary>내 Style DNA 요약</summary>
        <div className="detail-content">
          <p className="helper">
            {state.mode === "personal"
              ? `${state.personal.preferredStyle} · ${state.personal.bodyType} · ${state.personal.fitConcerns.join("/")} · ${state.personal.tpo}`
              : `P4 ${state.group.members.A.preferredStyle} + P5 ${state.group.members.B.preferredStyle} · ${state.group.tpo}`}
          </p>
        </div>
      </details>
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
              onClick={() => dispatch({ type: "selectInfluencer", influencerId: influencer.id, score: breakdown.total })}
            >
              <span className="match-photo">
                <span className="rank">TOP {index + 1}</span>
              </span>
              <span className="match-content">
                <span className="match-top">
                  <span>
                    <small>{view.tagline}</small>
                    <h3>{influencer.name}</h3>
                  </span>
                  <span className="match-score">
                    {breakdown.total}
                    <small>% 매칭</small>
                  </span>
                </span>
                <p>{view.description}</p>
                <span className="facts">
                  <span className="fact">◇ {view.price}</span>
                  <span className="fact">◇ {view.occasions}</span>
                </span>
                <span className="reason-bars">
                  <span className="reason-bar">
                    스타일 취향 <b>{breakdown.style}/30</b>
                    <span className="mini-track">
                      <span className="mini-fill" style={{ width: `${(breakdown.style / 30) * 100}%` }} />
                    </span>
                  </span>
                  <span className="reason-bar">
                    체형·핏 <b>{breakdown.fit}/25</b>
                    <span className="mini-track">
                      <span className="mini-fill" style={{ width: `${(breakdown.fit / 25) * 100}%` }} />
                    </span>
                  </span>
                  <span className="reason-bar">
                    예산·TPO <b>{breakdown.budget + breakdown.tpo}/35</b>
                    <span className="mini-track">
                      <span className="mini-fill" style={{ width: `${((breakdown.budget + breakdown.tpo) / 35) * 100}%` }} />
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </FlowShell>
  );
}
