import { useEffect, useState } from "react";
import type { PriorityOptionsRequest } from "../../domain/aiContracts.js";
import { getPriorityOptions } from "../../lib/biasfitApi.js";
import { useAppState } from "../../app/AppStateProvider.js";

export function PriorityQuestion({
  request,
}: {
  request: PriorityOptionsRequest;
}) {
  const { state, dispatch } = useAppState();
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "setPriorityLoading" });
    void getPriorityOptions(request, controller.signal)
      .then((result) =>
        dispatch({ type: "setPriorityOptions", options: result.options }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        dispatch({ type: "setPriorityError" });
      });
    return () => controller.abort();
  }, [dispatch, requestKey, retry]);

  return (
    <section className="soft-card" aria-live="polite">
      <h2 className="sub-title">
        이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.
      </h2>
      {state.priorityStatus === "loading" ? (
        <p className="helper">입력에 맞는 선택지를 만들고 있어요.</p>
      ) : null}
      {state.priorityStatus === "error" ? (
        <>
          <p className="error-copy" style={{ display: "block" }}>
            우선순위 선택지를 불러오지 못했어요.
          </p>
          <button className="btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>
            다시 시도
          </button>
        </>
      ) : null}
      {state.priorityStatus === "success" ? (
        <div className="card-grid" role="radiogroup" aria-label="매칭 우선순위">
          {state.priorityOptions.map((option) => (
            <button
              className={`option-card ${state.matchPriority === option.code ? "selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={state.matchPriority === option.code}
              key={option.code}
              onClick={() =>
                dispatch({ type: "selectMatchPriority", priority: option.code })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
