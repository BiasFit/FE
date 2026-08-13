import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../app/AppStateProvider";
import type { ProductItem } from "../../app/types";
import type { StylemateView } from "../../data/influencers";
import { budgetRangeLabel, tpoLabel } from "../../data/options";
import { FlowShell } from "../../shared/FlowShell";

/** 목록을 아직 못 받았을 때 화면이 깨지지 않게 쓰는 빈 값. */
const EMPTY_MATE: StylemateView = {
  id: "",
  name: "",
  profileCompleted: false,
  primaryStyle: "캐주얼",
  secondaryStyle: "로맨틱",
  bodyType: "웨이브",
  fitConcerns: [],
  budgetCodes: [],
  budgetApproach: "총액 절약형",
  tpos: [],
  coachingType: "both",
  tagline: "",
  description: "",
  price: "",
  occasions: "",
};

function useSelectedMate() {
  const { state } = useAppState();
  const directory = state.influencerDirectory;
  return (
    directory.find((profile) => profile.id === state.selectedInfluencerId) ??
    directory[0] ??
    EMPTY_MATE
  );
}

export function MatchScreen() {
  const navigate = useNavigate();
  const mate = useSelectedMate();
  const { state } = useAppState();
  const form = state.mode === "personal" ? state.personal : state.group.members.A;
  const tpo = tpoLabel(state.mode === "personal" ? state.personal.tpo : state.group.tpo);
  return (
    <FlowShell
      step={5}
      eyebrow="MATCH CONFIRM"
      title={
        <>
          이 스타일메이트와
          <br />
          코칭을 시작할까요?
        </>
      }
      description="전달되는 Style DNA와 요청 조건을 확인해 주세요."
      actions={
        <>
          <button className="btn-secondary" type="button" onClick={() => navigate("/user/top3")}>
            다른 사람 선택
          </button>
          <button className="btn-primary" type="button" onClick={() => navigate("/user/request")}>
            요청서 작성하기 <span aria-hidden="true">✓</span>
          </button>
        </>
      }
    >
      <div className="card selected-mate">
        <div className="selected-avatar" />
        <div>
          <span className="badge">TOP 1</span>
          <h3>{mate.name}</h3>
          <p className="helper">{mate.tagline} · {mate.occasions} 스타일 강점</p>
        </div>
        <div className="big-score">{state.selectedInfluencerScore}%</div>
      </div>
      <div className="mate-gallery" aria-label={`${mate.name} 스타일 무드`}>
        <span />
        <span />
        <span />
      </div>
      <h2 className="section-title">전달할 정보</h2>
      <dl className="summary-list card">
        <div className="summary-row"><dt>코칭 유형</dt><dd>{state.mode === "personal" ? "개인 코칭" : "2인 그룹 코칭"}</dd></div>
        <div className="summary-row"><dt>TPO</dt><dd>{tpo}</dd></div>
        <div className="summary-row"><dt>예산 기준</dt><dd>{state.mode === "personal" ? `${budgetRangeLabel(state.personal.budgetMinCode, state.personal.budgetMaxCode)} · ${state.personal.budgetApproach}` : `P4 ${budgetRangeLabel(state.group.members.A.budgetMinCode, state.group.members.A.budgetMaxCode)} · P5 ${budgetRangeLabel(state.group.members.B.budgetMinCode, state.group.members.B.budgetMaxCode)}`}</dd></div>
        <div className="summary-row"><dt>핏 기준</dt><dd>{state.mode === "personal" ? `${form.bodyType} · ${form.fitConcerns.join(" · ")}` : "P4 하의 길이/비율 · P5 상체 여유/어깨선"}</dd></div>
        <div className="summary-row"><dt>스타일 기준</dt><dd>{state.mode === "personal" ? `${form.preferredStyle} 선호 · ${form.avoidedStyle}은 피하고 싶음` : "P4 캐주얼 · P5 오피스 & 비즈니스캐주얼"}</dd></div>
      </dl>
      <div className="soft-card" style={{ marginTop: 16 }}>
        <p className="helper">◇ 실제 개인정보나 연락처는 전달하지 않아요. 스타일 선택에 필요한 더미 ID와 입력 기준만 공유합니다.</p>
      </div>
    </FlowShell>
  );
}

export function RequestScreen() {
  const navigate = useNavigate();
  const mate = useSelectedMate();
  const { state, dispatch } = useAppState();
  const value = state.requestText[state.mode];
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const tpo = tpoLabel(state.mode === "personal" ? state.personal.tpo : state.group.tpo);
  const send = () => {
    if (!value.trim()) {
      setError(true);
      return;
    }
    setError(false);
    dispatch({ type: "submitRequest" });
    setSending(true);
    window.setTimeout(() => navigate("/user/wait"), 700);
  };
  return (
    <FlowShell
      step={5}
      eyebrow="PLEASE CARD"
      title={
        <>
          스타일메이트에게
          <br />
          조금 더 부탁해 주세요.
        </>
      }
      description="꼭 반영하고 싶은 상황, 보유 아이템, 피하고 싶은 느낌을 적어주세요."
      actions={
        <>
          <button className="btn-ghost" type="button" onClick={() => navigate("/user/match")}>
            이전
          </button>
          <button className="btn-primary" type="button" disabled={sending} onClick={send}>
            {sending ? "보내는 중이에요." : "부탁해요 카드 보내기"} <span aria-hidden="true">→</span>
          </button>
        </>
      }
    >
      <div className="card selected-mate" style={{ gridTemplateColumns: "74px 1fr" }}>
        <div className="selected-avatar" style={{ width: 74, height: 74 }} />
        <div>
          <strong>{mate.name}</strong>
          <p className="helper">{state.mode === "personal" ? "개인 코칭" : "2인 그룹 코칭"} · {tpo}</p>
        </div>
      </div>
      <details className="disclosure" open>
        <summary>Style DNA 요약 보기</summary>
        <div className="detail-content">
          <p className="helper style-summary-copy">
            {state.mode === "personal"
              ? "로맨틱 75 · 웨이브 · 전체 기장/비율 · 가성비 중심 · 개강/새학기"
              : "P4 캐주얼 75 · P5 오피스 75 · 그룹 스타일 조합도 61 · 여행/사진"}
          </p>
        </div>
      </details>
      <div className="soft-card request-budget-summary">
        <strong>함께 보내는 원하는 가격대</strong>
        {state.mode === "personal" ? (
          <p>{budgetRangeLabel(state.personal.budgetMinCode, state.personal.budgetMaxCode)}</p>
        ) : (
          <p>
            P4 {budgetRangeLabel(state.group.members.A.budgetMinCode, state.group.members.A.budgetMaxCode)} · P5 {budgetRangeLabel(state.group.members.B.budgetMinCode, state.group.members.B.budgetMaxCode)}
          </p>
        )}
        <p className="helper">스타일 진단에서 선택한 예산이 요청서와 함께 전달돼요.</p>
      </div>
      <div className={`request-letter ${error ? "is-error" : ""}`} style={{ marginTop: 18 }}>
        <label className="field">
          <span className="field-label">부탁해요 카드 <span className="required">필수</span></span>
          <textarea
            aria-label="부탁해요 카드"
            className="textarea"
            value={value}
            onChange={(event) => {
              setError(false);
              dispatch({
                type: "updateRequest",
                mode: state.mode,
                value: event.target.value,
              });
            }}
          />
        </label>
        <p className="helper">꼭 반영하고 싶은 상황, 보유 아이템, 피하고 싶은 느낌을 적어주세요.</p>
        {error ? <p className="error-copy" style={{ display: "block" }}>부탁해요 카드 내용을 입력해 주세요.</p> : null}
      </div>
    </FlowShell>
  );
}

export function WaitScreen() {
  const navigate = useNavigate();
  return (
    <section className="screen is-active">
      <div className="service-layout">
        <aside className="context-panel" />
        <div className="work-panel">
          <div className="status-state">
            <div className="status-icon">◷</div>
            <span className="badge">전송 완료</span>
            <h2 style={{ marginTop: 14 }}>스타일메이트가<br />코디 카드를 만들고 있어요.</h2>
            <p>부탁해요 카드와 스타일 진단 결과가 전달됐어요. 코디가 완성되면 결과 화면에서 확인할 수 있어요.</p>
            <button className="btn-primary" type="button" onClick={() => navigate("/user/outfit")}>
              완성된 코디 카드 보기 <span aria-hidden="true">→</span>
            </button>
            <button className="btn-ghost" type="button" style={{ marginTop: 8 }} onClick={() => navigate("/user/request")}>
              보낸 내용 확인
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OutfitScreen() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { state } = useAppState();
  const mate = useSelectedMate();

  const download = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "BiasFit-outfit-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlowShell
      step={5}
      wide
      eyebrow="OUTFIT CARD"
      title={<>나를 위한 코디 카드가<br />도착했어요.</>}
      description="저장해 두고 옷을 고를 때 나만의 기준으로 활용해 보세요."
      actions={
        <>
          <button className="btn-primary" type="button" disabled={saving} onClick={download}>
            {saving ? "이미지 만드는 중…" : "이미지로 저장하기"}
          </button>
        </>
      }
    >
      <div ref={cardRef}>
        {state.mode === "personal" ? (
          <article className="outfit-card">
            <div className="outfit-cover" role="img" aria-label="개강 캠퍼스 코디 이미지" />
            <div className="outfit-content">
              <div className="outfit-head"><div><span className="badge">개강·새학기</span><h2>부드러운 캠퍼스 레이어드</h2><p className="helper">{mate.name} · {budgetRangeLabel(state.requestBudget.personal.minCode, state.requestBudget.personal.maxCode)}</p></div><span className="badge dark">개인 코칭</span></div>
              <OutfitItems
                top={{ name: "소프트 핑크 가디건", url: "https://example.com/products/pink-cardigan" }}
                bottom={{ name: "아이보리 A라인 스커트", url: "https://example.com/products/a-line-skirt" }}
              />
              <div className="coach-message"><h3>P1님께 전하는 말</h3><p>허리선이 자연스럽게 잡히는 짧은 가디건과 무릎 위 A라인 스커트로 전체 비율을 정리했어요. 너무 꾸민 느낌이 부담스럽다면 이너를 기본 티셔츠로 바꿔도 좋아요.</p></div>
            </div>
          </article>
        ) : (
          <div>
            <div className="group-result-grid">
              <article className="outfit-card"><div className="outfit-cover" style={{ backgroundImage: "var(--photo-1)" }} /><div className="outfit-content"><span className="badge">구성원 A · P4</span><h2>라이트 캐주얼 여행룩</h2><OutfitItems top={{ name: "블루 가디건", url: "https://example.com/products/blue-cardigan" }} bottom={{ name: "A라인 스커트", url: "https://example.com/products/travel-skirt" }} /></div></article>
              <article className="outfit-card"><div className="outfit-cover" style={{ backgroundImage: "var(--photo-4)" }} /><div className="outfit-content"><span className="badge">구성원 B · P5</span><h2>클린 레이어드 여행룩</h2><OutfitItems top={{ name: "옥스퍼드 셔츠", url: "https://example.com/products/oxford-shirt" }} bottom={{ name: "와이드 슬랙스", url: "https://example.com/products/wide-slacks" }} /></div></article>
            </div>
            <div className="coach-message" style={{ marginTop: 14 }}><h3>P4님과 P5님께 전하는 말</h3><p>두 코디 모두 소프트 블루와 화이트를 공통 색으로 잡고, 상체는 가벼운 레이어드로 연결했어요. 실루엣은 각자의 핏 기준을 유지해 사진에서는 조화롭고 실제 착용은 편안하게 구성했습니다.</p></div>
          </div>
        )}
      </div>
    </FlowShell>
  );
}

function OutfitItems({ top, bottom }: { top: ProductItem; bottom: ProductItem }) {
  return (
    <div className="item-list">
      {([['상의', top], ['하의', bottom]] as const).map(([label, product]) => (
        <div className="item" key={label}>
          <small>{label}</small>
          <strong>{product.name}</strong>
          <a href={product.url} target="_blank" rel="noreferrer">상품 링크 보기</a>
        </div>
      ))}
    </div>
  );
}
