import { AuthError, requireAccount, requireRole, sendAuthAwareError } from "../../_lib/auth";
import { supabaseAdmin } from "../../_lib/supabase";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http";

/**
 * 부탁해요 카드를 전송한다. 매칭 1건당 1장이다 (DB_SCHEMA.md 5.22).
 *
 * 수신 한도 검사는 `send_request_card` Postgres 함수 안에서 원자적으로 이뤄진다.
 * 수신자 프로필 행을 먼저 잠그고 집계하므로 동시 전송으로 한도를 넘길 수 없다.
 * 한도는 하드코딩 3이 아니라 `influencer_profiles.max_received_request_count`를 읽는다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

export interface SendRequestInput {
  matchResultId: string;
  /** 화면용 id (`stylemate-01`). 서버가 influencer_profiles.id로 바꾼다. */
  influencerId: string;
  messageText: string;
  ownedItemsText?: string;
  avoidText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSendInput(value: unknown): SendRequestInput {
  if (!isRecord(value)) throw new Error("요청 내용이 없습니다.");
  const matchResultId = typeof value.matchResultId === "string" ? value.matchResultId : "";
  const influencerId = typeof value.influencerId === "string" ? value.influencerId : "";
  const messageText = typeof value.messageText === "string" ? value.messageText.trim() : "";
  if (!matchResultId) throw new Error("진단 결과 id가 필요합니다.");
  if (!influencerId) throw new Error("스타일메이트를 선택해 주세요.");
  if (!messageText) throw new Error("부탁해요 카드 내용을 입력해 주세요.");
  return {
    matchResultId,
    influencerId,
    messageText,
    ownedItemsText:
      typeof value.ownedItemsText === "string" ? value.ownedItemsText : undefined,
    avoidText: typeof value.avoidText === "string" ? value.avoidText : undefined,
  };
}

export async function sendRequestCard(
  accountId: string,
  input: SendRequestInput,
  client: Client = supabaseAdmin(),
): Promise<{ id: string }> {
  // 본인 매칭인지 확인한다. 남의 매칭에 요청을 붙일 수 없다.
  const match = await client
    .from("match_results")
    .select("id, account_id")
    .eq("id", input.matchResultId)
    .maybeSingle();
  if (match.error) {
    console.error("[BiasFit 요청] match_results 조회 실패", match.error);
    throw new Error("진단 결과를 확인하지 못했어요.");
  }
  if (!match.data) throw new AuthError("진단 결과를 찾을 수 없어요.", 404);
  if ((match.data as { account_id: string }).account_id !== accountId) {
    throw new AuthError("이 진단 결과로 요청을 보낼 수 있는 계정이 아니에요.", 403);
  }

  const profile = await client
    .from("influencer_profiles")
    .select("id, accounts!inner(dummy_login_id)")
    .eq("accounts.dummy_login_id", input.influencerId)
    .maybeSingle();
  if (profile.error || !profile.data) {
    throw new Error("스타일메이트를 찾지 못했어요.");
  }
  const receiverId = (profile.data as { id: string }).id;

  const { data, error } = await client.rpc("send_request_card", {
    p_match_result: input.matchResultId,
    p_writer: accountId,
    p_receiver: receiverId,
    p_message: input.messageText,
    p_owned_items: input.ownedItemsText ?? null,
    p_avoid_text: input.avoidText ?? null,
  });

  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("REQUEST_LIMIT_REACHED")) {
      // SCREEN_SPEC이 정한 문구. 남은 자리 수는 알려주지 않는다.
      throw new AuthError(
        "이 스타일메이트는 지금 더 많은 요청을 받을 수 없어요.",
        409,
      );
    }
    if (raw.includes("INFLUENCER_NOT_FOUND")) {
      throw new Error("스타일메이트를 찾지 못했어요.");
    }
    if (error.code === "23505") {
      throw new AuthError("이미 보낸 요청이에요.", 409);
    }
    console.error("[BiasFit 요청] send_request_card 실패", error);
    throw new Error("부탁해요 카드를 보내지 못했어요.");
  }

  if (typeof data !== "string") throw new Error("부탁해요 카드를 보내지 못했어요.");

  // 선택한 스타일메이트와 진행 상태를 매칭에 기록한다.
  // `request_sent`는 마이페이지의 "코디 카드 준비 중" 조회 조건이다 (DB_SCHEMA.md 2.1).
  const update = await client
    .from("match_results")
    .update({
      selected_influencer_profile_id: receiverId,
      status: "request_sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.matchResultId);
  if (update.error) {
    console.error("[BiasFit 요청] 선택 스타일메이트 기록 실패", update.error);
  }

  return { id: data };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = requireRole(await requireAccount(request), "user");
    const input = validateSendInput(readJsonBody(request));
    response.status(200).json(await sendRequestCard(account.accountId, input));
  } catch (error) {
    console.error("[BiasFit 요청] requests/send failed", error);
    sendAuthAwareError(response, error);
  }
}
