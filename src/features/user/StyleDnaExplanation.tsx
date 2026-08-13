import { useEffect, useState } from "react";
import { useAppState } from "../../app/AppStateProvider.js";
import type { StyleDnaExplanationRequest } from "../../domain/aiContracts.js";
import { getStyleDnaExplanation } from "../../lib/biasfitApi.js";

export function StyleDnaExplanation({
  request,
}: {
  request: StyleDnaExplanationRequest;
}) {
  // 결과는 전역 state에 둔다. 저장 시점에 이 값이 필요하고, 그때 AI를 다시 부르지 않는다.
  const { state, dispatch } = useAppState();
  const result = state.styleDna;
  const status = state.styleDnaStatus;
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "setStyleDnaLoading" });
    void getStyleDnaExplanation(request, controller.signal)
      .then((response) => dispatch({ type: "setStyleDna", result: response }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit AI2] Style DNA 설명 호출 실패", error);
        dispatch({ type: "setStyleDnaError" });
      });
    return () => controller.abort();
  }, [requestKey, retry]);

  if (status === "idle" || status === "loading") {
    return <div className="soft-card" aria-live="polite">Style DNA 설명을 만들고 있어요.</div>;
  }
  if (status === "error" || !result) {
    return (
      <div className="soft-card" aria-live="polite">
        <p className="error-copy" style={{ display: "block" }}>설명을 불러오지 못했어요. 계산된 점수는 유지됩니다.</p>
        <button className="btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
      </div>
    );
  }
  if (result.mode === "personal") {
    return (
      <section className="soft-card">
        <h2 className="sub-title">{result.personalStyleDnaSummary}</h2>
        <ul>
          {result.personalMatchingPoints.map((point) => <li key={point.text}>{point.text}</li>)}
        </ul>
      </section>
    );
  }
  return (
    <section className="soft-card">
      <h2 className="sub-title">{result.groupStyleDnaSummary}</h2>
      <h3>{result.groupCombination.title}</h3>
      <p>{result.groupCombination.description}</p>
      <ul>
        {result.groupMatchingPoints.map((point) => <li key={point.text}>{point.text}</li>)}
      </ul>
    </section>
  );
}
