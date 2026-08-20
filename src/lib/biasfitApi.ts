import type {
  MatchExplanationsRequest,
  MatchExplanationsResponse,
  OutfitReviewRequest,
  OutfitReviewResponse,
  PriorityOptionsRequest,
  PriorityOptionsResponse,
  ReviewStatus,
  StyleDnaExplanationRequest,
  StyleDnaExplanationResponse,
} from "../domain/aiContracts.js";
import type {
  SavedTestResult,
  TestResultPayload,
} from "../domain/resultSnapshot.js";
import type { StylemateView } from "../data/influencers.js";
import type { RankedInfluencer, RankMatchInput } from "../domain/scoring.js";
import { anonUserKey } from "../storage/anonUser.js";
import { isAuthConfigured, supabase } from "./supabaseClient.js";

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

/**
 * 이 스타일메이트가 **지금** 요청을 더 받을 수 있는지. TOP 3에서 고른 직후에 부른다.
 *
 * 목록을 만든 뒤에도 다른 사용자가 마지막 자리를 채울 수 있어, 화면을 넘기기 전에 한 번 더 묻는다.
 * 남은 자리 수는 서버가 주지 않는다 — 사용자에게 보여주지 않는 값이다.
 */
export function getInfluencerAvailability(
  influencerId: string,
  signal?: AbortSignal,
) {
  return postJson<{ available: boolean }>(
    "/api/matches/availability",
    { influencerId },
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

export type OutfitCardReviewStatus = "pending" | ReviewStatus;

export interface OutfitCardItemView {
  memberLabel: "self" | "A" | "B";
  itemType: "top" | "bottom";
  name: string;
  url: string;
  linkCheckStatus: "pending" | "pass" | "operations_review" | "failed";
  linkCheckReason: string | null;
}

export interface OutfitCardView {
  outfitCardId: string;
  matchResultId: string;
  coachingType: "personal" | "group";
  title: string;
  message: string;
  tpoCode: string;
  tpoLabel: string;
  budgetLabel: string;
  budgetApproach: string;
  influencerName: string;
  reviewStatus: OutfitCardReviewStatus;
  status: "draft" | "reviewing" | "delivered";
  deliveredAt: string | null;
  items: OutfitCardItemView[];
}

/**
 * 코디 카드를 제출한다.
 * pass면 즉시 전달되고, operations_review면 카드가 저장돼 운영진 확인을 기다린다.
 * needs_revision/blocked면 저장하지 않고 검수 내역만 돌려준다.
 */
export function deliverOutfitCard(
  input: {
    matchResultId: string;
    title: string;
    message: string;
    cards: Array<{
      memberId: "self" | "A" | "B";
      top: { name: string; url: string };
      bottom: { name: string; url: string };
    }>;
  },
  signal?: AbortSignal,
) {
  return postJson<{
    delivered: boolean;
    outfitCardId: string | null;
    review: OutfitReviewResponse;
  }>("/api/outfit/deliver", input, signal);
}

export interface MypageDiagnosis {
  styleDnaResultId: string;
  matchResultId: string | null;
  diagnosedAt: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  styleDnaSummary: string;
  styleTags: string[];
  /** null이면 화면에 `매칭 전`으로 쓴다. */
  selectedInfluencerName: string | null;
}

export interface MypageOutfit {
  outfitCardId: string;
  matchResultId: string;
  title: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  influencerName: string;
  deliveredAt: string | null;
}

export interface MypagePending {
  matchResultId: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  influencerName: string | null;
  requestSentAt: string | null;
  requestMessage: string;
}

export interface MypageOverview {
  loginId: string;
  displayName: string;
  summary: {
    outfitCardCount: number;
    diagnosisCount: number;
    lastActivityAt: string | null;
  };
  diagnoses: MypageDiagnosis[];
  outfits: MypageOutfit[];
  pending: MypagePending[];
}

/**
 * 마이페이지 한 화면분 기록. 저장된 스냅샷만 읽고 다시 계산하지 않는다.
 *
 * `tpoCode`를 주면 세 목록(진단 기록·코디 카드·준비 중)에 함께 걸린다.
 * 요약 수치는 필터와 무관한 전체 기준이다.
 * 코디 카드 본문은 `getOutfitCard(matchResultId)`로 따로 받는다.
 */
export function getMypageOverview(tpoCode?: string, signal?: AbortSignal) {
  return postJson<MypageOverview>(
    "/api/mypage/overview",
    tpoCode ? { tpoCode } : {},
    signal,
  );
}

/**
 * 전달된 코디 카드. 아직 전달 전이면 `card`가 null이다.
 * id를 생략하면 로그인한 사용자의 가장 최근 카드를 준다 —
 * 요청을 보낸 뒤 브라우저를 닫았다 돌아온 경우다.
 */
export function getOutfitCard(matchResultId?: string, signal?: AbortSignal) {
  return postJson<{ card: OutfitCardView | null }>(
    "/api/outfit/get",
    matchResultId ? { matchResultId } : {},
    signal,
  );
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

/** 인플루언서 첫 프로필 저장. 서버에 있어야 매칭 후보가 된다. */
export function saveInfluencerProfile(
  input: {
    primaryStyle: string;
    secondaryStyle: string;
    bodyType: string;
    fitConcerns: string[];
    budgetMinCode: number;
    budgetMaxCode: number;
    budgetApproach: string;
    tpos: string[];
    coachingType: "personal_only" | "group_only" | "both";
    representativeMood?: string;
  },
  signal?: AbortSignal,
) {
  return postJson<{ id: string }>("/api/influencers/upsert", input, signal);
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
  outfitReviewStatus: OutfitCardReviewStatus | null;
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

export interface RequestCardView {
  messageText: string;
  ownedItemsText: string | null;
  avoidText: string | null;
  sentAt: string | null;
}

/**
 * MVP 테스트 KPI용 화면 이벤트 (`MEMO/KPI_측정_계획.md`).
 * `api/_routes/events/track.ts`의 `KPI_EVENT_NAMES`와 **같은 목록이어야 한다.**
 */
export type KpiEventName =
  | "style_dna_viewed"
  | "influencer_selected"
  | "outfit_image_save";

/**
 * 지표 하나를 남긴다. **결과를 기다리지 않고, 실패해도 삼킨다.**
 *
 * KPI 기록이 사용자 흐름을 막으면 안 된다 — 서버가 죽어 있어도 이미지 저장은 그대로 동작해야 한다.
 * 그래서 부르는 쪽은 `await`하지 않고, 여기서 오류를 밖으로 내보내지 않는다.
 * 실패 사실은 서버 로그(`[BiasFit 지표]`)에 남는다.
 */
export function trackEvent(eventName: KpiEventName, screen?: string) {
  void postJson("/api/events/track", {
    eventName,
    anonUserKey: anonUserKey(),
    screen,
  }).catch(() => {});
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
  /** 사용자가 실제로 쓴 부탁해요 카드. 아직 안 보냈으면 null. */
  requestCard: RequestCardView | null;
}
