import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../app/AppStateProvider.js";
import type { AppState } from "../../app/appState.js";
import type { StylemateView } from "../../data/influencers.js";
import { budgetRangeLabel, tpoLabel } from "../../data/options.js";
import {
  getOutfitCard,
  sendRequestCard,
  type OutfitCardView,
} from "../../lib/biasfitApi.js";
import { influencerPhotoStyle } from "../../shared/influencerPhoto.js";
import { Pill, PrimaryCta, TopBar } from "../../shared/AppShell.js";
import iconAvatar from "../../assets/mypage/icon-avatar.svg";
import iconItemPlaceholder from "../../assets/mypage/icon-item-placeholder.svg";
import bgAurora from "../../assets/mypage/bg-aurora.svg";
import iconStepDone from "../../assets/mypage/icon-step-done.svg";
import iconStepActive from "../../assets/mypage/icon-step-active.svg";
import iconStepPending from "../../assets/mypage/icon-step-pending.svg";
import iconChevronDown from "../../assets/mypage/icon-chevron-down.svg";

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
  profileImageUrl: null,
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

/**
 * "함께 전달되는 정보" 행 6개. 개인 모드는 피그마 A5 그대로다.
 * 그룹 모드는 필드가 사람별로 나뉘어 있어(예산·핏 고민 등), 화면 하나에 넣으려고
 * 두 사람 값을 " · "로 합쳐 보여준다 — 값을 지어내지 않고 있는 값만 합친다.
 */
function matchInfoRows(state: AppState) {
  const isGroup = state.mode === "group";
  const tpo = tpoLabel(isGroup ? state.group.tpo : state.personal.tpo);

  if (!isGroup) {
    const form = state.personal;
    return [
      { label: "스타일링 유형", value: "개인 스타일링" },
      { label: "필요한 상황", value: tpo },
      { label: "예산 범위", value: budgetRangeLabel(form.budgetMinCode, form.budgetMaxCode) },
      { label: "구매 기준", value: form.budgetApproach },
      { label: "핏 고민", value: form.fitConcerns.join(" / ") || "특별히 없음" },
      { label: "선호 / 비선호", value: `${form.preferredStyle} / ${form.avoidedStyle}` },
    ];
  }

  const { A, B } = state.group.members;
  return [
    { label: "스타일링 유형", value: "2인 그룹 스타일링" },
    { label: "필요한 상황", value: tpo },
    {
      label: "예산 범위",
      value: `A ${budgetRangeLabel(A.budgetMinCode, A.budgetMaxCode)} · B ${budgetRangeLabel(B.budgetMinCode, B.budgetMaxCode)}`,
    },
    { label: "구매 기준", value: `A ${A.budgetApproach} · B ${B.budgetApproach}` },
    {
      label: "핏 고민",
      value: `A ${A.fitConcerns.join("/") || "없음"} · B ${B.fitConcerns.join("/") || "없음"}`,
    },
    { label: "선호 / 비선호", value: `A ${A.preferredStyle}·${A.avoidedStyle} / B ${B.preferredStyle}·${B.avoidedStyle}` },
  ];
}

/** A5 · 스타일링 요청 확인. TOP 3에서 "선택하기"를 누르면 여기로 와서 한 번 더 확인한다.
 * 확정해야만 U6(부탁해요 카드)로 넘어간다 — 되돌린 화면(2026-08-15, 피그마 A5로 복원). */
export function MatchScreen() {
  const navigate = useNavigate();
  const mate = useSelectedMate();
  const { state } = useAppState();
  const rows = matchInfoRows(state);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/top3")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[14px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          이 스타일메이트에게
          <br />
          요청할까요?
        </h1>
        <div className="h-[10px]" />
        <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#8e8e93]">
          확정 후에는 다른 인플루언서로 바꿀 수 없어요.
        </p>
        <div className="h-[30px]" />

        <div className="flex w-full items-center gap-4 rounded-[20px] border-[1.6px] border-[#0a0a0a] bg-white p-5 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
          <span
            className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-[#ededf0]"
            style={influencerPhotoStyle(mate.profileImageUrl)}
          >
            {!mate.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">{mate.name}</p>
            <p className="mt-[6px] truncate text-[11px] font-semibold text-[#8e8e93]">
              {mate.tagline} · {tpoLabel(state.mode === "group" ? state.group.tpo : state.personal.tpo)}
            </p>
          </div>
          <p className="shrink-0 text-[28px] font-bold tracking-[-0.84px] text-[#0a0a0a]">
            {Math.round(state.selectedInfluencerScore)}
          </p>
        </div>

        <div className="mt-[30px] text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">함께 전달되는 정보</div>
        <div className="mt-[6px] flex flex-col rounded-[18px] bg-[#f5f5f7] px-[18px]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-[14px] py-3">
              <p className="w-[104px] shrink-0 text-[12px] text-[#8e8e93]">{row.label}</p>
              <p className="flex-1 text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#0a0a0a]">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div className="h-4" />
        <p className="text-[12px] leading-[1.5] text-[#8e8e93]">
          Style DNA 요약이 함께 전달돼요.
          <br />
          연락처와 계정 정보는 전달되지 않아요.
        </p>
      </div>
      <div className="flex flex-col gap-[10px] px-5 pb-[26px] pt-[10px]">
        <button
          type="button"
          onClick={() => navigate("/user/request")}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white"
        >
          확정하기
        </button>
        <button
          type="button"
          onClick={() => navigate("/user/top3")}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] border border-[#e8e8ec] bg-white text-[15px] font-bold text-[#3c3c43]"
        >
          다른 인플루언서 선택하기
        </button>
      </div>
    </section>
  );
}

/** U6 · 부탁해요 카드. */
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

  const tips = [
    "그날의 구체적인 상황과 이동 시간",
    "평소 자주 겪는 스타일 고민",
    "이미 가지고 있는 아이템",
    "피하고 싶은 느낌",
  ];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/top3")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          스타일메이트에게
          <br />
          요청하고 싶은 내용을 적어주세요.
        </h1>
        <p className="mt-[10px] text-[15px] leading-[1.52] text-[#8e8e93]">
          진단에 담기지 않은 내용을 자유롭게 적을 수 있어요.
          <br />
          최종 전송 후에는 수정할 수 없어요.
        </p>

        <div className="mt-7 flex items-center gap-[14px] rounded-[18px] bg-[#f5f5f7] px-[18px] py-4">
          <span
            className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full bg-[#f2f2f5]"
            style={influencerPhotoStyle(mate.profileImageUrl)}
          >
            {!mate.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">{mate.name}</p>
            <p className="truncate text-[11px] text-[#8e8e93]">
              {mate.tagline} · {state.mode === "personal" ? "개인 스타일링" : "2인 그룹 스타일링"}
            </p>
          </div>
          <Pill tone="dark">매칭 완료</Pill>
        </div>

        <div className="mt-[26px]">
          <textarea
            aria-label="부탁해요 카드"
            value={value}
            onChange={(event) => {
              setError(false);
              dispatch({ type: "updateRequest", mode: state.mode, value: event.target.value });
            }}
            className={
              error
                ? "min-h-[210px] w-full rounded-[18px] border-[1.6px] border-[#0a0a0a] p-[18px] text-[15px] leading-[1.52] text-[#0a0a0a] outline-none"
                : "min-h-[210px] w-full rounded-[18px] border-[1.6px] border-[#0a0a0a] p-[18px] text-[15px] leading-[1.52] text-[#0a0a0a] outline-none"
            }
            placeholder={`예) 개강 첫 주에 학과 오티랑 조모임 발표가 같이 있어요. 너무 차려입은 느낌은 부담스럽고, 하루 종일 앉아 있어도 편한 옷이면 좋겠어요.\n가지고 있는 건 검정 슬랙스랑 흰 반팔티, 데님 팬츠예요. 어깨가 좁은 편이라 소매가 길면 옷이 커 보여서 그 부분만 피해주시면 좋겠어요.`}
          />
        </div>
        <div className="mt-[10px] flex items-center justify-between text-[13px] text-[#8e8e93]">
          <p>구체적으로 적을수록 코디 카드가 정확해져요.</p>
          <p className="shrink-0">{value.length}자</p>
        </div>
        {error ? <p className="mt-2 text-[13px] font-semibold text-[#0a0a0a]">부탁해요 카드 내용을 입력해 주세요.</p> : null}
        {sendError ? (
          <p className="mt-2 text-[13px] font-semibold text-[#0a0a0a]" aria-live="polite">
            {sendError}
          </p>
        ) : null}

        <div className="mt-[26px] rounded-[18px] bg-[#f5f5f7] p-[18px]">
          <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">이런 내용을 적어 보세요</p>
          <div className="mt-3 flex flex-col gap-2 text-[13px] leading-[1.5] text-[#3c3c43]">
            {tips.map((tip) => (
              <p key={tip}>· {tip}</p>
            ))}
          </div>
        </div>
      </div>
      <PrimaryCta onClick={send} disabled={sending}>
        {sending ? "전송하는 중이에요." : "전송하기"}
      </PrimaryCta>
    </section>
  );
}

/** A6 · 전송 완료 · 코디 카드 대기 (피그마 `12 · v3 · 추가 화면`).
 *
 * 4단계 중 "스타일메이트 확인"까지는 이 화면에 온 시점에 이미 참인 것만 완료로 표시한다 —
 * 부탁해요 카드 전송이 성공했다는 건 서버가 그 요청을 스타일메이트 큐에 배정했다는 뜻이라,
 * 두 단계 다 이 시점에 정직하게 "완료"라고 할 수 있다. "코디 카드 작성 중"은 실제로는
 * 세분화된 진행 상태를 서버에서 안 받아오니 항상 진행 중으로만 표시하고, 완성 여부는
 * 코디 카드 화면(U7)·마이페이지에서 실제로 확인한다.
 */
export function WaitScreen() {
  const navigate = useNavigate();
  const mate = useSelectedMate();
  const { state } = useAppState();
  const [cardOpen, setCardOpen] = useState(false);
  const message = state.requestText[state.mode];
  const today = new Date();
  const sentOn = `${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  const steps = [
    { label: "부탁해요 카드 전송", icon: iconStepDone, status: "완료" },
    { label: "스타일메이트 확인", icon: iconStepDone, status: "완료" },
    { label: "코디 카드 작성 중", icon: iconStepActive, status: "진행 중" },
    { label: "코디 카드 도착", icon: iconStepPending, status: null },
  ];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-[520px] overflow-hidden">
          <img src={bgAurora} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="relative">
          <TopBar onBack={() => navigate("/user/outfit")} />
          <div className="flex flex-col px-5 pb-6 pt-10">
            <Pill tone="dark">전송 완료</Pill>
            <div className="h-5" />
            <h1 className="m-0 text-[28px] font-bold leading-normal text-[#0a0a0a]">
              작성하신 내용이
              <br />
              스타일메이트에게 전달됐어요.
            </h1>
            <div className="h-[14px]" />
            <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#3c3c43]">
              코디 카드가 도착하면 알려드릴게요.
              <br />
              기다리는 동안 앱을 닫아도 괜찮아요.
            </p>
            <div className="h-10" />

            <div className="flex w-full items-center gap-4 rounded-[20px] bg-[#f5f5f7] p-5">
              <span
                className="relative flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[#ededf0]"
                style={influencerPhotoStyle(mate.profileImageUrl)}
              >
                {!mate.profileImageUrl ? <img src={iconAvatar} alt="" className="size-[22px]" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">{mate.name}</p>
                <p className="mt-[6px] truncate text-[11px] font-semibold text-[#8e8e93]">
                  {state.mode === "group" ? "그룹" : "개인"} ·{" "}
                  {tpoLabel(state.mode === "group" ? state.group.tpo : state.personal.tpo)} · {sentOn} 요청
                </p>
              </div>
              <Pill>작성 중</Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-6">
        <div className="flex flex-col">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`flex items-center gap-[14px] py-[14px] ${index > 0 ? "border-t border-[#e8e8ec]" : ""}`}
            >
              <img src={step.icon} alt="" className="size-5" />
              <p
                className={
                  step.status === "진행 중"
                    ? "text-[12px] font-bold text-[#0a0a0a]"
                    : "text-[12px] text-[#0a0a0a]"
                }
              >
                {step.label}
              </p>
              <div className="flex-1" />
              {step.status ? (
                <p
                  className={
                    step.status === "진행 중"
                      ? "text-[11px] font-semibold tracking-[-0.055px] text-[#0a0a0a]"
                      : "text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]"
                  }
                >
                  {step.status}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="h-[26px]" />

        <div className="w-full rounded-[18px] bg-[#f5f5f7] px-5 py-[18px]">
          <button
            type="button"
            onClick={() => setCardOpen((v) => !v)}
            className="flex w-full items-center gap-2"
          >
            <span className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">내가 보낸 부탁해요 카드</span>
            <div className="flex-1" />
            <img
              src={iconChevronDown}
              alt=""
              className={`size-5 transition-transform ${cardOpen ? "rotate-180" : ""}`}
            />
          </button>
          {cardOpen ? (
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.5] text-[#3c3c43]">
              {message || "작성한 요청 내용이 없어요."}
            </p>
          ) : null}
        </div>
        <div className="h-[18px]" />
        <p className="text-[12px] text-[#8e8e93]">보낸 내용은 수정하거나 다시 보낼 수 없어요.</p>
      </div>
      <div className="px-5 pb-[26px] pt-[10px]">
        <button
          type="button"
          onClick={() => navigate("/user/mypage")}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] border border-[#e8e8ec] bg-white text-[15px] font-bold text-[#3c3c43]"
        >
          기록에서 확인하기
        </button>
      </div>
    </section>
  );
}

/** U7 · 코디 카드. 마이페이지의 코디 카드 기록 상세(U9)와 거의 같은 몸통이지만,
 * 전달 직후 화면이라 "그때의 Style DNA" 같은 회고용 아코디언은 없다. */
export function OutfitScreen() {
  const navigate = useNavigate();
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
      link.download = "Fitto-outfit-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/wait")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        {status === "loading" ? <p className="text-[15px] text-[#8e8e93]">코디 카드를 불러오는 중이에요.</p> : null}
        {status === "error" ? <p className="text-[13px] text-[#8e8e93]">코디 카드를 불러오지 못했어요.</p> : null}
        {status === "success" && !card ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] bg-[#f5f5f7] px-6 py-14 text-center">
            <Pill>코디 카드 준비 중</Pill>
            <p className="text-[14px] leading-[1.5] text-[#8e8e93]">
              스타일메이트가 코디 카드를 만들고 있어요.
              <br />
              완성되면 이 화면에서 확인할 수 있어요.
            </p>
          </div>
        ) : null}

        {card ? (
          <>
            <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
              코디 카드가 도착했어요.
            </h1>
            <p className="mt-[10px] text-[15px] text-[#8e8e93]">이미지로 저장하면 쇼핑할 때 바로 열어볼 수 있어요.</p>
            <div className="h-[26px]" />

            <div ref={cardRef} className="w-full rounded-[22px] bg-[#f5f5f7] px-5 pb-5 pt-6">
              <p className="text-[22px] font-bold tracking-[-0.44px] text-[#0a0a0a]">{card.title}</p>
              <div className="h-[14px]" />
              <div className="flex flex-wrap gap-[6px]">
                <Pill>{card.coachingType === "group" ? "그룹 스타일링" : "개인 스타일링"}</Pill>
                <Pill>{card.tpoLabel}</Pill>
                <Pill>{card.budgetLabel}</Pill>
              </div>
              <div className="h-[22px]" />
              <p className="text-[13px] text-[#8e8e93]">추천 코디</p>
              <div className="h-[10px]" />
              <div className="flex flex-col gap-[10px]">
                {card.items.map((item, index) => (
                  <div key={`${item.itemType}-${index}`} className="flex w-full items-center gap-[14px] rounded-[16px] bg-white p-[14px]">
                    <span className="relative flex h-[76px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-[#f2f2f5]">
                      <img src={iconItemPlaceholder} alt="" className="size-[22px]" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                      <p className="text-[11px] font-semibold text-[#8e8e93]">{item.itemType === "top" ? "상의" : "하의"}</p>
                      <p className="text-[15px] font-medium text-[#0a0a0a]">{item.name}</p>
                      <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-[11px] font-semibold text-[#3c3c43] underline decoration-[#e8e8ec] underline-offset-2">
                        {item.url}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-[22px]" />
              <p className="text-[13px] text-[#8e8e93]">전하는 말</p>
              <div className="h-[10px]" />
              <div className="w-full rounded-[16px] bg-white p-4">
                <p className="whitespace-pre-wrap text-[15px] leading-[1.52] text-[#0a0a0a]">{card.message}</p>
              </div>
              <div className="h-[18px]" />
              <div className="flex w-full items-center gap-2">
                <p className="text-[11px] font-semibold text-[#8e8e93]">by {card.influencerName}</p>
                <div className="flex-1" />
                <p className="text-[11px] font-semibold text-[#0a0a0a]">Fitto</p>
              </div>
            </div>

            <div className="h-4" />
            <p className="text-[13px] leading-[1.5] text-[#8e8e93]">
              코디 카드는 스타일메이트가 1회 전달한 결과예요.
              <br />
              기록 탭에서 다시 볼 수 있어요.
            </p>
          </>
        ) : null}
      </div>
      {card ? (
        <div className="flex flex-col items-start overflow-clip px-5 pb-[26px] pt-[10px]">
          <div className="flex w-full gap-[10px]">
            <button
              type="button"
              disabled={saving}
              onClick={download}
              className="flex min-h-[56px] flex-1 items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-60"
            >
              {saving ? "이미지 만드는 중…" : "이미지 저장"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={download}
              className="flex min-h-[56px] flex-1 items-center justify-center rounded-[14px] border border-[#e8e8ec] bg-white text-[15px] font-bold text-[#3c3c43] disabled:opacity-60"
            >
              다운로드
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
