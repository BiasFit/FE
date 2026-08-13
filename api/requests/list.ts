import { tpoLabel } from "../../src/data/options";
import { requireAccount, requireRole, sendAuthAwareError } from "../_lib/auth";
import { supabaseAdmin } from "../_lib/supabase";
import {
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/**
 * 로그인한 인플루언서에게 배정된 부탁해요 카드 목록.
 * **자기 요청만 본다.** 수신자 프로필은 토큰에서 꺼낸 계정으로 찾는다
 * (INFLUENCER_SCREEN_SPEC.md 3.3 "다른 스타일메이트의 요청은 표시하지 않는다").
 */
type Client = ReturnType<typeof supabaseAdmin>;

export interface AssignedRequestView {
  requestCardId: string;
  matchResultId: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  status: "draft" | "sent" | "read";
  sentAt: string | null;
  /** 코디 카드가 이미 전달됐는지. 목록에서 작성 필요/전달 완료를 가른다. */
  delivered: boolean;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function loadAssignedRequests(
  accountId: string,
  client: Client = supabaseAdmin(),
): Promise<AssignedRequestView[]> {
  const profile = await client
    .from("influencer_profiles")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (profile.error) {
    console.error("[BiasFit 요청] influencer_profiles 조회 실패", profile.error);
    throw new Error("프로필 정보를 불러오지 못했어요.");
  }
  // 프로필이 없으면 아직 첫 프로필을 만들지 않은 계정이다. 빈 목록이 정상이다.
  if (!profile.data) return [];

  const { data, error } = await client
    .from("request_cards")
    .select(
      `id, match_result_id, status, sent_at,
       match_results!inner (
         diagnosis_session_id,
         diagnosis_sessions!inner ( coaching_type ),
         outfit_cards ( status )
       )`,
    )
    .eq("receiver_influencer_profile_id", (profile.data as { id: string }).id)
    .in("status", ["sent", "read"])
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[BiasFit 요청] request_cards 조회 실패", error);
    throw new Error("배정 요청을 불러오지 못했어요.");
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  const views: AssignedRequestView[] = [];

  for (const row of rows) {
    const match = one<Record<string, any>>(row.match_results);
    const session = one<{ coaching_type: "personal" | "group" }>(match?.diagnosis_sessions);
    // outfit_cards.match_result_id에 unique가 걸려 있어 PostgREST가 배열이 아니라
    // 객체 하나로 돌려준다. 배열로 단정하면 카드가 생기는 순간 목록 전체가 깨진다.
    const outfits = (
      Array.isArray(match?.outfit_cards)
        ? match?.outfit_cards
        : match?.outfit_cards
          ? [match.outfit_cards]
          : []
    ) as Array<{ status: string }>;

    // TPO는 세션 단위로 한 건 저장돼 있다.
    const tpo = await client
      .from("selected_tpos")
      .select("diagnosis_options!inner(code)")
      .eq("diagnosis_session_id", (match as any)?.diagnosis_session_id ?? "")
      .eq("scope", "session")
      .maybeSingle();
    const tpoCode =
      one<{ code: string }>((tpo.data as Record<string, any> | null)?.diagnosis_options)?.code ?? "";

    views.push({
      requestCardId: row.id,
      matchResultId: row.match_result_id,
      coachingType: session?.coaching_type ?? "personal",
      tpoCode,
      tpoLabel: tpoLabel(tpoCode),
      status: row.status,
      sentAt: row.sent_at,
      delivered: outfits.some((card) => card.status === "delivered"),
    });
  }

  return views;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = requireRole(await requireAccount(request), "influencer");
    response.status(200).json({ requests: await loadAssignedRequests(account.accountId) });
  } catch (error) {
    console.error("[BiasFit 요청] requests/list failed", error);
    sendAuthAwareError(response, error);
  }
}
