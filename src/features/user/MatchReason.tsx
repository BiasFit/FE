import type { AiRequestStatus } from "../../app/types.js";
import type { MatchExplanation } from "../../domain/aiContracts.js";

export function MatchReason({
  explanation,
  status,
}: {
  explanation?: MatchExplanation;
  status: AiRequestStatus;
}) {
  if (status === "idle" || status === "loading") {
    return <span className="helper">추천 근거를 만들고 있어요.</span>;
  }
  if (status === "error" || !explanation) {
    return <span className="error-copy" style={{ display: "block" }}>추천 근거를 불러오지 못했어요.</span>;
  }
  return <span className="helper">{explanation.summary}</span>;
}
