import type {
  MatchExplanationsRequest,
  MatchExplanationsResponse,
  OutfitReviewRequest,
  OutfitReviewResponse,
  PriorityOptionsRequest,
  PriorityOptionsResponse,
  StyleDnaExplanationRequest,
  StyleDnaExplanationResponse,
} from "../domain/aiContracts";
import type {
  SavedTestResult,
  TestResultPayload,
} from "../domain/resultSnapshot";
import type { RankedInfluencer, RankMatchInput } from "../domain/scoring";

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "서버 요청을 처리하지 못했습니다.",
    );
  }
  return payload as T;
}

export function getPriorityOptions(
  input: PriorityOptionsRequest,
  signal?: AbortSignal,
) {
  return postJson<PriorityOptionsResponse>(
    "/api/ai/priority-options",
    input,
    signal,
  );
}

export function getStyleDnaExplanation(
  input: StyleDnaExplanationRequest,
  signal?: AbortSignal,
) {
  return postJson<StyleDnaExplanationResponse>(
    "/api/ai/style-dna-explanation",
    input,
    signal,
  );
}

export function getTopThree(input: RankMatchInput, signal?: AbortSignal) {
  return postJson<{ rankedInfluencers: RankedInfluencer[] }>(
    "/api/matches/top-three",
    input,
    signal,
  );
}

export function getMatchExplanations(
  input: MatchExplanationsRequest,
  signal?: AbortSignal,
) {
  return postJson<MatchExplanationsResponse>(
    "/api/ai/match-explanations",
    input,
    signal,
  );
}

export function reviewOutfit(
  input: OutfitReviewRequest,
  signal?: AbortSignal,
) {
  return postJson<OutfitReviewResponse>("/api/outfit/review", input, signal);
}

export function saveTestResult(
  input: TestResultPayload,
  signal?: AbortSignal,
) {
  return postJson<SavedTestResult>("/api/results/save", input, signal);
}
