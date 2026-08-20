import type {
  LinkCheck,
  OutfitReviewRequest,
  OutfitReviewResponse,
} from "../../../src/domain/aiContracts.js";
import { AuthError, requireAccount, requireRole, sendAuthAwareError } from "../../_lib/auth.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";
import { reviewOutfitCard } from "./review.js";

/**
 * 코디 카드를 사용자에게 전달한다. 요청 1건당 1회뿐이고 전달 후 수정·재전송은 없다
 * (INFLUENCER_SCREEN_SPEC.md 3.4, DB_SCHEMA.md 5.23).
 *
 * **순서가 곧 안전장치다.**
 *   1. 링크 검사 + AI5 안전 표현 검수 (둘 다 review.ts 안에서 병렬로 돈다)
 *   2. `reviewStatus === 'pass'`일 때만 저장한다
 *   3. 저장할 때 비로소 `status = 'delivered'`가 된다
 *
 * 통과하지 못하면 **아무것도 저장하지 않는다.** 초안은 브라우저 로컬 저장소가 맡고
 * 서버 DB에 두지 않기로 문서가 정해 뒀다 (DB_SCHEMA.md 6장).
 * 그래서 검수 실패는 오류가 아니라 `delivered: false`와 검수 결과로 돌아간다.
 * 인플루언서는 그 내역을 보고 고쳐서 다시 전달한다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

export type MemberLabel = "self" | "A" | "B";

export interface DeliverOutfitInput {
  matchResultId: string;
  title: string;
  message: string;
  cards: Array<{
    memberId: MemberLabel;
    top: { name: string; url: string };
    bottom: { name: string; url: string };
  }>;
}

export interface DeliverOutfitResult {
  delivered: boolean;
  outfitCardId: string | null;
  review: OutfitReviewResponse;
}

interface DeliverDependencies {
  review(input: OutfitReviewRequest): Promise<OutfitReviewResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function product(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label} 정보를 입력해 주세요.`);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  if (!name) throw new Error(`${label} 제품명을 입력해 주세요.`);
  // http/https만 받는다. outfit_card_items.product_url에도 같은 제약이 걸려 있다.
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new Error(`${label} 상품 링크는 http 또는 https로 시작해야 해요.`);
  }
  return { name, url };
}

export function validateDeliverInput(value: unknown): DeliverOutfitInput {
  if (!isRecord(value)) throw new Error("전달할 코디 카드 내용이 없습니다.");
  const matchResultId = typeof value.matchResultId === "string" ? value.matchResultId : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!matchResultId) throw new Error("요청 id가 필요합니다.");
  if (!title) throw new Error("코디 카드 제목을 입력해 주세요.");
  if (!message) throw new Error("사용자에게 전하는 말을 입력해 주세요.");
  if (!Array.isArray(value.cards) || value.cards.length === 0) {
    throw new Error("코디 카드 내용을 입력해 주세요.");
  }

  const cards: DeliverOutfitInput["cards"] = value.cards.map((card) => {
    if (!isRecord(card)) throw new Error("코디 카드 내용을 입력해 주세요.");
    const memberId = card.memberId;
    if (memberId !== "self" && memberId !== "A" && memberId !== "B") {
      throw new Error("코디 카드의 구성원 구분이 올바르지 않습니다.");
    }
    const who = memberId === "self" ? "" : `구성원 ${memberId} `;
    return {
      memberId,
      top: product(card.top, `${who}상의`),
      bottom: product(card.bottom, `${who}하의`),
    };
  });

  return { matchResultId, title, message, cards };
  }

  function persistedLinkStatus(status: LinkCheck["status"]) {
    // DB의 link_check_status에는 needs_revision이 없으므로 failed로 저장한다.
    return status === "needs_revision" ? "failed" : status;
  }

/** 전달에 필요한 요청 맥락. 전부 저장된 값에서 읽고 다시 계산하지 않는다. */
interface DeliveryContext {
  requestCardId: string;
  userAccountId: string;
  influencerProfileId: string;
  styleDnaResultId: string;
  coachingType: "personal" | "group";
  tpoOptionId: string;
  budgetMinOptionId: string;
  budgetMaxOptionId: string;
  budgetStrategyOptionId: string;
  /** member_label → session_members.id */
  memberIds: Map<MemberLabel, string>;
}

async function loadDeliveryContext(
  client: Client,
  accountId: string,
  matchResultId: string,
): Promise<DeliveryContext> {
  const profile = await client
    .from("influencer_profiles")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (profile.error) {
    console.error("[BiasFit 코디] influencer_profiles 조회 실패", profile.error);
    throw new Error("프로필 정보를 불러오지 못했어요.");
  }
  if (!profile.data) throw new AuthError("먼저 프로필을 완성해 주세요.", 403);
  const influencerProfileId = (profile.data as { id: string }).id;

  const request = await client
    .from("request_cards")
    .select(
      `id, receiver_influencer_profile_id,
       match_results!inner ( account_id, style_dna_result_id, diagnosis_session_id )`,
    )
    .eq("match_result_id", matchResultId)
    .maybeSingle();
  if (request.error) {
    console.error("[BiasFit 코디] request_cards 조회 실패", request.error);
    throw new Error("요청 정보를 불러오지 못했어요.");
  }
  if (!request.data) throw new AuthError("요청을 찾을 수 없어요.", 404);

  const requestRow = request.data as Record<string, any>;
  // 배정받은 본인만 쓸 수 있다. 다른 스타일메이트의 요청에는 카드를 붙일 수 없다.
  if (requestRow.receiver_influencer_profile_id !== influencerProfileId) {
    throw new AuthError("접근할 수 없는 요청이에요.", 403);
  }

  const match = one<Record<string, any>>(requestRow.match_results);
  if (!match) throw new Error("요청 정보를 불러오지 못했어요.");
  const sessionId = match.diagnosis_session_id as string;

  const session = await client
    .from("diagnosis_sessions")
    .select("coaching_type")
    .eq("id", sessionId)
    .maybeSingle();
  const coachingType = (session.data as { coaching_type: "personal" | "group" } | null)
    ?.coaching_type;
  if (!coachingType) throw new Error("요청 정보를 불러오지 못했어요.");

  const tpo = await client
    .from("selected_tpos")
    .select("tpo_option_id")
    .eq("diagnosis_session_id", sessionId)
    .eq("scope", "session")
    .maybeSingle();
  const tpoOptionId = (tpo.data as { tpo_option_id: string } | null)?.tpo_option_id;
  if (!tpoOptionId) throw new Error("요청의 TPO를 확인하지 못했어요.");

  const members = await client
    .from("session_members")
    .select("id, member_label")
    .eq("diagnosis_session_id", sessionId)
    .order("member_order");
  const memberRows = (members.data ?? []) as Array<{ id: string; member_label: MemberLabel }>;
  if (memberRows.length === 0) throw new Error("요청 정보를 불러오지 못했어요.");
  const memberIds = new Map(memberRows.map((row) => [row.member_label, row.id]));

  const budget = await budgetOptionIds(
    client,
    memberRows.map((row) => row.id),
  );

  return {
    requestCardId: requestRow.id as string,
    userAccountId: match.account_id as string,
    influencerProfileId,
    styleDnaResultId: match.style_dna_result_id as string,
    coachingType,
    tpoOptionId,
    ...budget,
    memberIds,
  };
}

/**
 * 코디 카드의 예산은 인플루언서가 정하지 않는다. 요청 정보를 그대로 옮긴다
 * (INFLUENCER_SCREEN_SPEC.md 3.4 "예산은 요청 정보라서 수정할 수 없어요").
 *
 * 그룹은 구성원 둘의 구간이 다를 수 있어 **가장 낮은 최소값과 가장 높은 최고값**을 쓴다.
 * 예산 접근 방식은 한 칸뿐이라 첫 번째 구성원 것을 쓴다.
 */
async function budgetOptionIds(client: Client, memberIds: string[]) {
  const { data, error } = await client
    .from("member_style_inputs")
    .select(
      `session_member_id, budget_min_option_id, budget_max_option_id, budget_strategy_option_id,
       min:diagnosis_options!member_style_inputs_budget_min_option_id_fkey ( code ),
       max:diagnosis_options!member_style_inputs_budget_max_option_id_fkey ( code )`,
    )
    .in("session_member_id", memberIds);

  if (error) {
    console.error("[BiasFit 코디] member_style_inputs 조회 실패", error);
    throw new Error("요청의 예산 정보를 불러오지 못했어요.");
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  if (rows.length === 0) throw new Error("요청의 예산 정보를 불러오지 못했어요.");

  // 구성원 순서를 유지한다. 접근 방식은 첫 번째 구성원 것을 쓴다.
  const ordered = memberIds
    .map((id) => rows.find((row) => row.session_member_id === id))
    .filter((row): row is Record<string, any> => Boolean(row));

  let lowest = ordered[0];
  let highest = ordered[0];
  for (const row of ordered) {
    if (Number(one<{ code: string }>(row.min)?.code) < Number(one<{ code: string }>(lowest.min)?.code)) {
      lowest = row;
    }
    if (Number(one<{ code: string }>(row.max)?.code) > Number(one<{ code: string }>(highest.max)?.code)) {
      highest = row;
    }
  }

  return {
    budgetMinOptionId: lowest.budget_min_option_id as string,
    budgetMaxOptionId: highest.budget_max_option_id as string,
    budgetStrategyOptionId: ordered[0].budget_strategy_option_id as string,
  };
}

export async function deliverOutfitCard(
  accountId: string,
  input: DeliverOutfitInput,
  client: Client = supabaseAdmin(),
  dependencies: DeliverDependencies = { review: reviewOutfitCard },
): Promise<DeliverOutfitResult> {
  const context = await loadDeliveryContext(client, accountId, input.matchResultId);

  const expectedLabels: MemberLabel[] =
    context.coachingType === "group" ? ["A", "B"] : ["self"];
  const labels = input.cards.map((card) => card.memberId);
  if (
    labels.length !== expectedLabels.length ||
    expectedLabels.some((label) => !labels.includes(label))
  ) {
    throw new Error(
      context.coachingType === "group"
        ? "2인 그룹 요청은 구성원 A와 B의 코디 카드가 모두 필요해요."
        : "개인 요청은 코디 카드 1개만 전달할 수 있어요.",
    );
  }

    const existing = await client
    .from("outfit_cards")
    .select("id, status, review_status")
    .eq("match_result_id", input.matchResultId)
    .maybeSingle();

  if (existing.error) {
    console.error("[BiasFit 코디] 기존 outfit_cards 조회 실패", existing.error);
    throw new Error("코디 카드 상태를 확인하지 못했어요.");
  }

  const existingCard = existing.data as {
    id: string;
    status: string;
    review_status: string | null;
  } | null;

  if (existingCard?.status === "delivered") {
    throw new AuthError("이미 전달한 코디 카드예요. 수정하거나 다시 보낼 수 없어요.", 409);
  }

  if (existingCard?.status === "reviewing") {
    throw new AuthError("코디 카드가 운영진 확인 중이에요.", 409);
  }

  // 운영진 반려 카드만 다시 제출할 수 있다.
  if (
    existingCard &&
    !(
      existingCard.status === "draft" &&
      existingCard.review_status === "needs_revision"
    )
  ) {
    throw new AuthError("현재 코디 카드를 다시 제출할 수 없어요.", 409);
  }

  const review = await dependencies.review({
    mode: context.coachingType,
    coachingMessage: input.message,
    cards: input.cards,
  });

  const isOperationsReview = review.reviewStatus === "operations_review";
  const isDelivered = review.reviewStatus === "pass";

  // 링크 수정·문구 수정이 필요한 자동 검수 실패는 기존처럼 저장하지 않는다.
  if (!isDelivered && !isOperationsReview) {
    return { delivered: false, outfitCardId: null, review };
  }

  const now = new Date().toISOString();

  /*
   * 카드와 아이템이 모두 저장된 뒤에만 delivered/reviewing 상태로 바꾼다.
   * 중간 실패 시 사용자가 빈 카드를 보지 못하게 한다.
   */
  const draftCardValues = {
    match_result_id: input.matchResultId,
    request_card_id: context.requestCardId,
    style_dna_result_id: context.styleDnaResultId,
    user_account_id: context.userAccountId,
    influencer_profile_id: context.influencerProfileId,
    coaching_type: context.coachingType,
    title: input.title,
    representative_tpo_option_id: context.tpoOptionId,
    budget_min_option_id: context.budgetMinOptionId,
    budget_max_option_id: context.budgetMaxOptionId,
    budget_strategy_option_id: context.budgetStrategyOptionId,
    message_to_user: input.message,
    review_status: "pending",
    safe_language_issues:
      review.safeLanguageIssues.length > 0 ? review.safeLanguageIssues : null,
    reviewed_at: now,
    status: "draft",
    delivered_at: null,
  };

  const preparedCard = existingCard
    ? await client
        .from("outfit_cards")
        .update(draftCardValues)
        .eq("id", existingCard.id)
        .select("id")
        .single()
    : await client
        .from("outfit_cards")
        .insert(draftCardValues)
        .select("id")
        .single();

  if (
    preparedCard.error ||
    typeof (preparedCard.data as { id?: unknown } | null)?.id !== "string"
  ) {
    console.error("[BiasFit 코디] outfit_cards 저장 실패", preparedCard.error);
    throw new Error("코디 카드를 제출하지 못했어요.");
  }

  const outfitCardId = (preparedCard.data as { id: string }).id;
  const createdCard = !existingCard;

  try {
    if (existingCard) {
      const removed = await client
        .from("outfit_card_items")
        .delete()
        .eq("outfit_card_id", outfitCardId);

      if (removed.error) {
        console.error("[BiasFit 코디] 기존 outfit_card_items 삭제 실패", removed.error);
        throw new Error("기존 코디 카드 내용을 정리하지 못했어요.");
      }
    }

    const linkOf = (memberId: MemberLabel, itemType: "top" | "bottom") =>
      review.linkChecks.find(
        (check) => check.memberId === memberId && check.itemType === itemType,
      );

    const items = input.cards.flatMap((entry, cardIndex) =>
      (["top", "bottom"] as const).map((itemType, index) => {
        const link = linkOf(entry.memberId, itemType);

        return {
          outfit_card_id: outfitCardId,
          session_member_id:
            context.coachingType === "group"
              ? context.memberIds.get(entry.memberId) ?? null
              : null,
          item_type: itemType,
          item_name: entry[itemType].name,
          product_url: entry[itemType].url,
          final_url: link?.finalUrl ?? null,
          link_check_status: link
            ? persistedLinkStatus(link.status)
            : "failed",
          link_check_reason: link?.reason ?? "링크 검사 결과가 없습니다.",
          link_checked_at: now,
          sort_order: cardIndex * 2 + index + 1,
        };
      }),
    );

    const savedItems = await client.from("outfit_card_items").insert(items);

    if (savedItems.error) {
      console.error("[BiasFit 코디] outfit_card_items 저장 실패", savedItems.error);
      throw new Error("코디 카드 항목을 저장하지 못했어요.");
    }

    const finalized = await client
      .from("outfit_cards")
      .update({
        review_status: review.reviewStatus,
        safe_language_issues:
          review.safeLanguageIssues.length > 0 ? review.safeLanguageIssues : null,
        reviewed_at: now,
        status: isDelivered ? "delivered" : "reviewing",
        delivered_at: isDelivered ? now : null,
      })
      .eq("id", outfitCardId);

    if (finalized.error) {
      console.error("[BiasFit 코디] outfit_cards 최종 상태 갱신 실패", finalized.error);
      throw new Error("코디 카드 상태를 갱신하지 못했어요.");
    }
  } catch (error) {
    if (createdCard) {
      const cleanup = await client
        .from("outfit_cards")
        .delete()
        .eq("id", outfitCardId);

      if (cleanup.error) {
        console.error("[BiasFit 코디] 실패한 코디 카드 정리 실패", cleanup.error);
      }
    } else {
      await client
        .from("outfit_cards")
        .update({
          review_status: "pending",
          status: "draft",
          delivered_at: null,
        })
        .eq("id", outfitCardId);
    }

    throw error;
  }

  const read = await client
    .from("request_cards")
    .update({ status: "read", updated_at: now })
    .eq("id", context.requestCardId);

  if (read.error) console.error("[BiasFit 코디] 요청 읽음 처리 실패", read.error);

  const matched = await client
    .from("match_results")
    .update({
      status: isDelivered ? "outfit_completed" : "outfit_pending",
      updated_at: now,
    })
    .eq("id", input.matchResultId);

  if (matched.error) console.error("[BiasFit 코디] 매칭 상태 갱신 실패", matched.error);

  return { delivered: isDelivered, outfitCardId, review };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = requireRole(await requireAccount(request), "influencer");
    const input = validateDeliverInput(readJsonBody(request));
    response.status(200).json(await deliverOutfitCard(account.accountId, input));
  } catch (error) {
    console.error("[BiasFit 코디] outfit/deliver failed", error);
    sendAuthAwareError(response, error);
  }
}
