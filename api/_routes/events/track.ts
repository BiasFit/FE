import { requireAccount } from "../../_lib/auth.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * MVP 테스트 KPI용 화면 이벤트를 받는다 (`MEMO/KPI_측정_계획.md`).
 *
 * 화면 안에서 끝나 DB에 아무 흔적이 남지 않던 행동 3가지만 받는다.
 * 나머지 지표는 이미 있는 표에서 세므로 여기로 보내지 않는다.
 *
 * ⚠️ 이 엔드포인트는 **사용자 흐름을 막을 권한이 없다.** 화면은 결과를 기다리지 않고
 * 실패해도 무시한다. 그래서 로그인하지 않았거나 토큰이 만료돼도 400을 내지 않고 그냥 받는다 —
 * 계정을 못 붙이면 익명 키로만 남긴다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

/** `client_events.event_name`의 check 제약과 **같은 목록이어야 한다** (schema/11_kpi.sql). */
export const KPI_EVENT_NAMES = [
  "style_dna_viewed",
  "influencer_selected",
  "outfit_image_save",
] as const;

export type KpiEventName = (typeof KPI_EVENT_NAMES)[number];

export interface TrackEventInput {
  eventName: KpiEventName;
  /** 로그인 전 행동을 같은 브라우저로 묶는 익명 키. 개인정보가 아니다 (DB_SCHEMA.md 6장). */
  anonUserKey?: string;
  /** 같은 이벤트가 여러 화면에 있을 때 구분한다. 예: `outfit` / `mypage_outfit`. */
  screen?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 길이를 자르지 않고 **거절한다.** 조용히 잘라 두면 나중에 값이 왜 다른지 알 수 없다. */
function optionalText(value: unknown, limit: number, tooLongMessage: string) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > limit) throw new Error(tooLongMessage);
  return trimmed;
}

export function validateTrackInput(value: unknown): TrackEventInput {
  if (!isRecord(value)) throw new Error("이벤트 내용이 없습니다.");
  const eventName = value.eventName;
  // 오타난 이름을 받아 두면 집계에서 조용히 빠진다. 여기서 거절한다.
  if (
    typeof eventName !== "string" ||
    !(KPI_EVENT_NAMES as readonly string[]).includes(eventName)
  ) {
    throw new Error("기록할 수 있는 이벤트가 아닙니다.");
  }
  return {
    eventName: eventName as KpiEventName,
    anonUserKey: optionalText(value.anonUserKey, 100, "익명 키가 너무 깁니다."),
    screen: optionalText(value.screen, 40, "화면 이름이 너무 깁니다."),
  };
}

/**
 * 토큰이 있으면 계정을 붙이고, 없거나 유효하지 않으면 `null`로 둔다.
 * `requireAccount`는 던지도록 만들어진 함수라(_lib/auth.ts) 여기서만 삼킨다.
 */
async function optionalAccountId(request: ApiRequest, client?: Client) {
  try {
    const account = await requireAccount(request, client);
    return account.accountId;
  } catch {
    return null;
  }
}

export async function recordEvent(
  accountId: string | null,
  input: TrackEventInput,
  client: Client = supabaseAdmin(),
): Promise<void> {
  const { error } = await client.from("client_events").insert({
    event_name: input.eventName,
    account_id: accountId,
    anon_key: input.anonUserKey ?? null,
    screen: input.screen ?? null,
  });

  if (error) {
    // 화면은 이 실패를 무시하므로, 여기 남기지 않으면 아무도 모른다.
    // 표가 아직 없을 때(schema/11_kpi.sql 미실행)도 이 줄로 드러난다.
    console.error("[BiasFit 지표] client_events insert 실패", error);
    throw new Error("이벤트를 기록하지 못했어요.");
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const input = validateTrackInput(readJsonBody(request));
    const accountId = await optionalAccountId(request);
    await recordEvent(accountId, input);
    response.status(200).json({ ok: true });
  } catch (error) {
    console.error("[BiasFit 지표] events/track failed", error);
    sendApiError(response, error);
  }
}
