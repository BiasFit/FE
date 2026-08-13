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
import type { StylemateView } from "../data/influencers";
import type { RankedInfluencer, RankMatchInput } from "../domain/scoring";
import { isAuthConfigured, supabase } from "./supabaseClient";

/**
 * 로그인했으면 모든 요청에 토큰을 붙인다. 서버는 이 토큰에서만 신원을 꺼낸다.
 * 여기 한 곳만 고치면 모든 엔드포인트에 적용된다.
 */
async function authHeaders(): Promise<Record<string, string>> {
  if (!isAuthConfigured) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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

export interface AccountView {
  accountId: string;
  role: "user" | "influencer";
  loginId: string;
  displayName: string;
}

export function createAccount(
  input: { role: AccountView["role"]; loginId: string; displayName: string },
  signal?: AbortSignal,
) {
  return postJson<AccountView>("/api/accounts/upsert", input, signal);
}

/** 현재 로그인 계정의 역할을 서버에 물어본다. 브라우저가 기억한 값은 조작할 수 있다. */
export function getMyAccount(signal?: AbortSignal) {
  return postJson<AccountView>("/api/accounts/me", {}, signal);
}

/** 프로필이 완료된 스타일메이트 전체. TOP 3 카드의 표시용 정보에 쓴다. */
export function getInfluencers(signal?: AbortSignal) {
  return postJson<{ influencers: StylemateView[] }>("/api/influencers/list", {}, signal);
}

/** 부탁해요 카드 전송. 수신 한도에 걸리면 409와 함께 안내 문구가 온다. */
export function sendRequestCard(
  input: {
    matchResultId: string;
    influencerId: string;
    messageText: string;
    ownedItemsText?: string;
    avoidText?: string;
  },
  signal?: AbortSignal,
) {
  return postJson<{ id: string }>("/api/requests/send", input, signal);
}

export interface AssignedRequestView {
  requestCardId: string;
  matchResultId: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  status: "draft" | "sent" | "read";
  sentAt: string | null;
  delivered: boolean;
}

/** 로그인한 인플루언서에게 배정된 요청만 돌려준다. */
export function getAssignedRequests(signal?: AbortSignal) {
  return postJson<{ requests: AssignedRequestView[] }>("/api/requests/list", {}, signal);
}

/** 저장된 진단 결과. 인플루언서 화면이 사용자 정보를 보여줄 때 쓴다. */
export function getDiagnosisResult(matchResultId: string, signal?: AbortSignal) {
  return postJson<DiagnosisResultView>("/api/results/get", { matchResultId }, signal);
}

export interface DiagnosisMemberView {
  memberLabel: "self" | "A" | "B";
  personaCode: string | null;
  heightCm: number | null;
  bodyType: string;
  preferredStyle: string;
  avoidedStyle: string;
  budgetLabel: string;
  budgetApproach: string;
  fitConcerns: string[];
  keywords: string[];
  designElements: string[];
  preferredItems: string[];
  avoidedElements: string[];
  fitNote: string | null;
  styleScores: Array<{ style: string; score: number; rank: number }>;
}

export interface DiagnosisResultView {
  matchResultId: string;
  coachingType: "personal" | "group";
  priority: string;
  tpoCode: string;
  tpoLabel: string;
  styleDnaSummary: string;
  matchingPoints: Array<{ text: string }>;
  groupCombination: { score: number | null; title: string | null; description: string | null } | null;
  relationship: string | null;
  members: DiagnosisMemberView[];
  selectedInfluencerName: string | null;
}
