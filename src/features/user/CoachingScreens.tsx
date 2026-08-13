import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../app/AppStateProvider";
import type { StylemateView } from "../../data/influencers";
import { budgetRangeLabel, tpoLabel } from "../../data/options";
import {
  getOutfitCard,
  sendRequestCard,
  type OutfitCardView,
} from "../../lib/biasfitApi";
import { DeliveredOutfitCard } from "../influencer/InfluencerScreens";
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
  const [sendError, setSendError] = useState("");
  const tpo = tpoLabel(state.mode === "personal" ? state.personal.tpo : state.group.tpo);
  const send = () => {
    if (!value.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setSendError("");

    if (!state.savedResultId || !state.selectedInfluencerId) {
      setSendError("진단 결과를 먼저 저장해야 요청을 보낼 수 있어요.");
      return;
    }

    setSending(true);
    void sendRequestCard({
      matchResultId: state.savedResultId,
      influencerId: state.selectedInfluencerId,
      messageText: value,
    })
      .then(() => {
        dispatch({ type: "submitRequest" });
        navigate("/user/wait");
      })
      .catch((error: unknown) => {
        // 수신 한도에 걸리면 409와 함께 안내 문구가 온다.
        // 남은 자리 수는 사용자에게 보여주지 않는다 (SCREEN_SPEC.md).
        setSendError(
          error instanceof Error ? error.message : "부탁해요 카드를 보내지 못했어요.",
        );
        setSending(false);
      });
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
            {/* 저장된 AI2 결과를 그대로 쓴다. 고정 문구를 쓰면 입력과 어긋난다. */}
            {state.styleDna
              ? state.styleDna.mode === "personal"
                ? state.styleDna.personalStyleDnaSummary
                : state.styleDna.groupStyleDnaSummary
              : "Style DNA 결과를 불러오는 중이에요."}
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
        {sendError ? <p className="error-copy" style={{ display: "block" }} aria-live="polite">{sendError}</p> : null}
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
  const { state } = useAppState();
  const [card, setCard] = useState<OutfitCardView | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // 인플루언서가 실제로 쓴 카드만 보여준다. 전달 전에는 카드가 없는 게 정상이고,
  // 그때는 준비 중 안내를 본다 (INFLUENCER_SCREEN_SPEC.md 3.4).
  //
  // 진행 중인 매칭 id는 화면 메모리에만 있다. 다시 접속했으면 비어 있으므로,
  // 그때는 서버가 이 계정의 가장 최근 카드를 찾아 준다.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void getOutfitCard(state.savedResultId || undefined, controller.signal)
      .then((result) => {
        setCard(result.card);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 코디] 코디 카드 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [state.savedResultId]);

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
      title={
        card ? (
          <>나를 위한 코디 카드가<br />도착했어요.</>
        ) : (
          <>코디 카드를<br />준비하고 있어요.</>
        )
      }
      description={
        card
          ? "저장해 두고 옷을 고를 때 나만의 기준으로 활용해 보세요."
          : "스타일메이트가 코디 카드를 다 만들면 여기에서 볼 수 있어요."
      }
      actions={
        card ? (
          <button className="btn-primary" type="button" disabled={saving} onClick={download}>
            {saving ? "이미지 만드는 중…" : "이미지로 저장하기"}
          </button>
        ) : null
      }
    >
      {status === "loading" ? (
        <div className="soft-card" aria-live="polite">코디 카드를 불러오는 중이에요.</div>
      ) : null}
      {status === "error" ? (
        <div className="soft-card" aria-live="polite">
          <p className="error-copy" style={{ display: "block" }}>코디 카드를 불러오지 못했어요.</p>
        </div>
      ) : null}
      {status === "success" && !card ? (
        <div className="status-state">
          <div className="status-icon">◷</div>
          <span className="badge">코디 카드 준비 중</span>
          <p>스타일메이트가 코디 카드를 만들고 있어요. 완성되면 이 화면에서 확인할 수 있어요.</p>
        </div>
      ) : null}
      {card ? (
        <div ref={cardRef}>
          <DeliveredOutfitCard card={card} />
        </div>
      ) : null}
    </FlowShell>
  );
}
