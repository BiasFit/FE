import type { OutfitReviewResponse } from "../../domain/aiContracts.js";

const statusLabel = {
  pass: "검수 통과",
  needs_revision: "문구 수정 필요",
  operations_review: "운영진 확인 대기",
  blocked: "링크 수정 필요",
} as const;

export function OutfitReviewPanel({ result }: { result: OutfitReviewResponse }) {
  return (
    <section className="soft-card" aria-live="polite">
      <h3>{statusLabel[result.reviewStatus]}</h3>
      {result.safeLanguageIssues.map((issue) => (
        <div key={`${issue.field}-${issue.phrase}`}>
          <strong>{issue.phrase}</strong>
          <p>{issue.reason}</p>
          <p>수정 제안: {issue.suggestedRewrite}</p>
        </div>
      ))}
      {result.linkChecks.filter((link) => link.status !== "pass").map((link) => (
        <p key={`${link.memberId}-${link.itemType}`}>
          {link.memberId} {link.itemType}: {link.reason} · {link.action}
        </p>
      ))}
    </section>
  );
}
