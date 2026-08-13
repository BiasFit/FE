import { budgetRangeLabel, tpoLabel } from "../../../src/data/options";
import { AuthError, requireAccount, sendAuthAwareError } from "../../_lib/auth";
import { supabaseAdmin } from "../../_lib/supabase";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http";
import type { MemberLabel } from "./deliver";

/**
 * 전달된 코디 카드를 조회한다. 저장된 내용만 읽고 다시 만들지 않는다 (DB_SCHEMA.md 2.1).
 *
 * 볼 수 있는 사람은 둘뿐이다 — 카드를 받은 사용자와, 그 카드를 쓴 인플루언서.
 * 아직 전달 전이면 오류가 아니라 `card: null`이다. 사용자 화면은 그때 `준비 중`을 보여준다
 * (INFLUENCER_SCREEN_SPEC.md 3.4 "사용자는 통과 전까지 코디 카드 준비 중만 본다").
 */
type Client = ReturnType<typeof supabaseAdmin>;

export interface OutfitCardItemView {
  memberLabel: MemberLabel;
  itemType: "top" | "bottom";
  name: string;
  url: string;
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
  deliveredAt: string | null;
  items: OutfitCardItemView[];
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function code(value: unknown) {
  return one<{ code: string }>(value as any)?.code ?? "";
}

/** 진단 결과 조회와 같은 규칙이다 — 본인이거나, 그 요청을 받은 인플루언서. */
async function assertViewer(
  client: Client,
  matchResultId: string,
  viewer: { accountId: string; role: "user" | "influencer" },
) {
  if (viewer.role === "user") {
    const match = await client
      .from("match_results")
      .select("account_id")
      .eq("id", matchResultId)
      .maybeSingle();
    if (match.error) {
      console.error("[BiasFit 코디] match_results 조회 실패", match.error);
      throw new Error("코디 카드를 불러오지 못했어요.");
    }
    if (!match.data) throw new AuthError("요청을 찾을 수 없어요.", 404);
    if ((match.data as { account_id: string }).account_id !== viewer.accountId) {
      throw new AuthError("이 코디 카드를 볼 수 있는 계정이 아니에요.", 403);
    }
    return;
  }

  const allowed = await client
    .from("request_cards")
    .select("id, influencer_profiles!inner(account_id)")
    .eq("match_result_id", matchResultId)
    .eq("influencer_profiles.account_id", viewer.accountId)
    .maybeSingle();
  if (allowed.error || !allowed.data) {
    throw new AuthError("접근할 수 없는 요청이에요.", 403);
  }
}

const CARD_COLUMNS = `id, match_result_id, coaching_type, title, message_to_user, delivered_at, status,
   influencer_profiles!inner ( display_name ),
   tpo:diagnosis_options!outfit_cards_representative_tpo_option_id_fkey ( code ),
   budget_min:diagnosis_options!outfit_cards_budget_min_option_id_fkey ( code ),
   budget_max:diagnosis_options!outfit_cards_budget_max_option_id_fkey ( code ),
   strategy:diagnosis_options!outfit_cards_budget_strategy_option_id_fkey ( code ),
   outfit_card_items ( session_member_id, item_type, item_name, product_url, sort_order )`;

/**
 * `matchResultId`를 주면 그 요청의 카드를, 주지 않으면 **사용자 본인의 가장 최근 전달 카드**를
 * 돌려준다.
 *
 * 후자가 필요한 이유는 분명하다. 진행 중인 매칭 id는 화면 메모리에만 있어서,
 * 사용자가 요청을 보낸 뒤 브라우저를 닫으면 다시는 자기 카드를 열 수 없다.
 * 인플루언서가 카드를 쓰는 데 걸리는 시간을 생각하면 그게 오히려 보통 상황이다.
 * 최신순 조회는 마이페이지 규칙과 같다 (DB_SCHEMA.md 2.1 `delivered_at` 최신순).
 */
export async function loadOutfitCard(
  matchResultId: string | null,
  viewer: { accountId: string; role: "user" | "influencer" },
  client: Client = supabaseAdmin(),
): Promise<{ card: OutfitCardView | null }> {
  if (matchResultId) {
    await assertViewer(client, matchResultId, viewer);
  } else if (viewer.role !== "user") {
    // 인플루언서는 "내 최근 카드"가 아니라 어떤 요청의 카드인지를 항상 지정해야 한다.
    throw new AuthError("요청 id가 필요합니다.", 400);
  }

  const query = client.from("outfit_cards").select(CARD_COLUMNS).eq("status", "delivered");
  const { data, error } = matchResultId
    ? await query.eq("match_result_id", matchResultId).maybeSingle()
    : await query
        .eq("user_account_id", viewer.accountId)
        .order("delivered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (error) {
    console.error("[BiasFit 코디] outfit_cards 조회 실패", error);
    throw new Error("코디 카드를 불러오지 못했어요.");
  }
  if (!data) return { card: null };

  const row = data as Record<string, any>;
  const coachingType = row.coaching_type as "personal" | "group";

  // 아이템은 session_member_id로 묶여 있다. 화면이 쓰는 A/B 라벨로 되돌린다.
  const labels = new Map<string, MemberLabel>();
  if (coachingType === "group") {
    const memberIds = ((row.outfit_card_items ?? []) as Array<Record<string, any>>)
      .map((item) => item.session_member_id)
      .filter((id): id is string => typeof id === "string");
    if (memberIds.length) {
      const members = await client
        .from("session_members")
        .select("id, member_label")
        .in("id", memberIds);
      for (const member of ((members.data ?? []) as Array<Record<string, any>>)) {
        labels.set(member.id, member.member_label);
      }
    }
  }

  const tpoCode = code(row.tpo);
  const items = ((row.outfit_card_items ?? []) as Array<Record<string, any>>)
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((item) => ({
      memberLabel:
        coachingType === "group" ? labels.get(item.session_member_id) ?? "A" : "self",
      itemType: item.item_type as "top" | "bottom",
      name: item.item_name as string,
      url: item.product_url as string,
    }));

  return {
    card: {
      outfitCardId: row.id,
      matchResultId: row.match_result_id,
      coachingType,
      title: row.title ?? "",
      message: row.message_to_user ?? "",
      tpoCode,
      tpoLabel: tpoLabel(tpoCode),
      budgetLabel: budgetRangeLabel(
        Number(code(row.budget_min)),
        Number(code(row.budget_max)),
      ),
      budgetApproach: code(row.strategy),
      influencerName: one<{ display_name: string }>(row.influencer_profiles)?.display_name ?? "",
      deliveredAt: row.delivered_at ?? null,
      items,
    },
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = await requireAccount(request);
    const body = readJsonBody(request) as { matchResultId?: unknown };
    const matchResultId =
      typeof body?.matchResultId === "string" && body.matchResultId ? body.matchResultId : null;
    response.status(200).json(await loadOutfitCard(matchResultId, account));
  } catch (error) {
    console.error("[BiasFit 코디] outfit/get failed", error);
    sendAuthAwareError(response, error);
  }
}
