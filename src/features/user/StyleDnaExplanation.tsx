import { useEffect, useState } from "react";
import type {
  StyleDnaExplanationRequest,
  StyleDnaExplanationResponse,
} from "../../domain/aiContracts";
import { getStyleDnaExplanation } from "../../lib/biasfitApi";

export function StyleDnaExplanation({
  request,
}: {
  request: StyleDnaExplanationRequest;
}) {
  const [result, setResult] = useState<StyleDnaExplanationResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void getStyleDnaExplanation(request, controller.signal)
      .then((response) => {
        setResult(response);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit AI2] Style DNA 설명 호출 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [requestKey, retry]);

  if (status === "loading") {
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
