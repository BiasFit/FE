import { DEFAULT_RECEIVED_REQUEST_LIMIT } from "../../../src/domain/scoring.js";
import { loadReceivedRequestCounts } from "../../_lib/influencerProfiles.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 이 스타일메이트가 **지금** 부탁해요 카드를 더 받을 수 있는지.
 *
 * TOP 3는 목록을 만드는 시점에만 한도를 본다. 그 뒤 선택·확정·작성까지 다섯 화면을 거치는
 * 동안 다른 사용자가 마지막 자리를 채울 수 있고, 그러면 사용자는 전송 버튼에서야 막혔다.
 * 그래서 화면을 넘기기 직전에 한 번 더 묻는 자리를 둔다.
 *
 * **이 응답은 안내용이지 보증이 아니다.** 진짜 한도 검사는 여전히 전송 시점의
 * `send_request_card`(schema/09_functions.sql) 안에서 원자적으로 이뤄진다.
 *
 * 인증을 요구하지 않는다. 돌려주는 값이 `true`/`false` 하나뿐이라 남의 정보가 새지 않고,
 * TOP 3 조회(`matches/top-three`)와 같은 수준으로 열어 두어야 흐름이 끊기지 않는다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

export function validateAvailabilityInput(value: unknown): string {
  const influencerId =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>).influencerId
      : undefined;
  if (typeof influencerId !== "string" || !influencerId.trim()) {
    throw new Error("스타일메이트를 선택해 주세요.");
  }
  return influencerId.trim();
}

/**
 * 한도에 여유가 있고 프로필이 완료된 상태일 때만 `true`.
 *
 * `loadReceivedRequestCounts`가 세는 기준(`status in ('sent','read')`)을 그대로 쓴다.
 * 여기서 따로 세면 TOP 3 필터와 어긋나, 목록에는 있는데 선택은 막히는 상태가 생긴다.
 */
export async function isInfluencerAvailable(
  influencerId: string,
  client: Client = supabaseAdmin(),
): Promise<boolean> {
  const profile = await client
    .from("influencer_profiles")
    .select("profile_status, accounts!inner(dummy_login_id)")
    .eq("accounts.dummy_login_id", influencerId)
    .maybeSingle();

  if (profile.error) {
    console.error("[BiasFit 매칭] availability 프로필 조회 실패", profile.error);
    throw new Error("스타일메이트 정보를 불러오지 못했어요.");
  }
  // 프로필이 없거나 아직 완료 전이면 후보가 아니다 (loadInfluencerProfiles와 같은 조건).
  if (!profile.data) return false;
  if ((profile.data as { profile_status: string }).profile_status !== "completed") {
    return false;
  }

  const { counts, limits } = await loadReceivedRequestCounts(client);
  const received = counts[influencerId] ?? 0;
  const limit = limits[influencerId] ?? DEFAULT_RECEIVED_REQUEST_LIMIT;
  return received < limit;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const influencerId = validateAvailabilityInput(readJsonBody(request));
    // 남은 자리 수도 수신 수도 담지 않는다. 사용자에게 보여주지 않는 값이다
    // (Design_system-2.md 179행, STYLE_SCORING_DRAFT.md 3장).
    response.status(200).json({ available: await isInfluencerAvailable(influencerId) });
  } catch (error) {
    console.error("[BiasFit 매칭] availability failed", error);
    sendApiError(response, error);
  }
}
