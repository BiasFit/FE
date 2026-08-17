import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPriorityOptions } from "../../lib/biasfitApi.js";
import { useAppState } from "../../app/AppStateProvider.js";
import type { AppState } from "../../app/appState.js";
import { PrimaryCta, StepHeader } from "../../shared/AppShell.js";
import type { MatchPriority } from "../../app/types.js";
import type { PriorityOptionsRequest } from "../../domain/aiContracts.js";
import { completeForm } from "../../domain/diagnosisComplete.js";
import iconCheck from "../../assets/mypage/icon-check.svg";

/**
 * U3-5 · AI 매칭 우선순위. 예전에는 TpoScreen 안에 끼워진 위젯(PriorityQuestion)이었는데,
 * 피그마에서 독립된 마지막 화면으로 분리됐다 (2026-08-15). 데이터를 읽어오는 로직은
 * 그대로고, 화면만 새로 짰다.
 *
 * 카드마다 굵은 "카테고리 제목"과 그 아래 옅은 "개인화 설명" 두 줄이 있는데,
 * `PriorityOption`에는 `label` 한 줄만 있다. AI가 실제로 계산 근거를 담아 만드는
 * 문장은 `label` 쪽이라 그걸 버리지 않고, 제목만 코드(4가지 고정값)로 붙였다 —
 * 매칭 로직/AI 응답 형식은 그대로 두고 화면에서만 두 줄로 나눠 보여주는 것이다.
 */
/** 이번 모드의 진단 입력이 다 찼을 때만 요청을 만든다. 한 명이라도 비면 보내지 않는다. */
function priorityRequest(state: AppState): PriorityOptionsRequest | null {
  if (state.mode === "personal") {
    const personal = completeForm(state.personal);
    return personal ? { mode: "personal", personal } : null;
  }
  const memberA = completeForm(state.group.members.A, state.group.tpo);
  const memberB = completeForm(state.group.members.B, state.group.tpo);
  if (!memberA || !memberB || !state.group.tpo) return null;
  return {
    mode: "group",
    group: {
      relationship: state.group.relationship,
      relationshipOther: state.group.relationshipOther,
      tpo: state.group.tpo,
      members: { A: memberA, B: memberB },
    },
  };
}

export const PRIORITY_CATEGORY_TITLE: Record<MatchPriority, string> = {
  style_first: "스타일이 가장 중요해요",
  fit_first: "핏이 가장 중요해요",
  budget_first: "예산이 가장 중요해요",
  tpo_first: "상황(TPO)이 가장 중요해요",
};
export function PriorityScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const [retry, setRetry] = useState(0);
  // 다 채운 입력만 보낸다. 앞 단계가 막고 있어 평소에는 null이 나오지 않는다.
  const request = priorityRequest(state);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    if (!request) {
      dispatch({ type: "setPriorityError" });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "setPriorityLoading" });
    void getPriorityOptions(request, controller.signal)
      .then((result) => dispatch({ type: "setPriorityOptions", options: result.options }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        dispatch({ type: "setPriorityError" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, requestKey, retry]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="5 / 5"
        progress={1}
        onBack={() => navigate("/user/budget")}
        title="이번 스타일링에서 가장 중요한 기준은요?"
        description="선택한 기준의 매칭 비중이 높아져요. 세부 점수 기준은 그대로예요."
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[22px]">
        <span className="inline-flex w-fit items-center rounded-full bg-[#f5f5f7] px-3 py-[6px] text-[11px] font-semibold tracking-[-0.055px] text-[#3c3c43]">
          내 입력값을 읽고 정리했어요
        </span>
        <div className="mt-[30px] flex flex-col gap-3" role="radiogroup" aria-label="매칭 우선순위" aria-live="polite">
          {state.priorityStatus === "loading" ? (
            <p className="text-[13px] text-[#8e8e93]">입력에 맞는 선택지를 만들고 있어요.</p>
          ) : null}
          {state.priorityStatus === "error" ? (
            <div className="rounded-[18px] bg-[#f5f5f7] px-5 py-6">
              <p className="text-[13px] text-[#8e8e93]">우선순위 선택지를 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          {state.priorityStatus === "success"
            ? state.priorityOptions.map((option) => {
                const selected = state.matchPriority === option.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    onClick={() => dispatch({ type: "selectMatchPriority", priority: option.code })}
                    className={
                      selected
                        ? "rounded-[18px] border-[1.6px] border-[#0a0a0a] bg-white p-5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                        : "rounded-[18px] bg-[#f5f5f7] p-5 text-left"
                    }
                  >
                    <div className="flex w-full items-center gap-[10px]">
                      <p className="text-[17px] font-semibold tracking-[-0.34px] text-[#0a0a0a]">
                        {PRIORITY_CATEGORY_TITLE[option.code]}
                      </p>
                      <div className="flex-1" />
                      {selected ? <img src={iconCheck} alt="" className="size-[22px] shrink-0" /> : null}
                    </div>
                    <div className="h-2" />
                    <p className="text-[13px] leading-[1.5] text-[#3c3c43]">{option.label}</p>
                  </button>
                );
              })
            : null}
        </div>
        <p className="mt-[18px] text-[13px] text-[#8e8e93]">기준은 1개만 고를 수 있어요. 건너뛰기는 없어요.</p>
      </div>
      <PrimaryCta
        onClick={() => navigate("/user/loading")}
        disabled={!state.matchPriority || state.priorityStatus !== "success"}
      >
        진단 결과 보기
      </PrimaryCta>
    </section>
  );
}
