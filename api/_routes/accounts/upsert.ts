import {
  AuthError,
  requireAuthUser,
  sendAuthAwareError,
  type AccountRole,
} from "../../_lib/auth.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 가입 직후 `accounts` 행을 만든다 (DB_SCHEMA.md 5.1).
 * 이미 있으면 그대로 돌려준다 — 가입 중 새로고침해도 중복 행이 생기지 않는다.
 *
 * ⚠️ `authUserId`는 요청 본문이 아니라 **토큰에서 꺼낸다.**
 * 본문으로 받으면 남의 계정을 만들거나 가로챌 수 있다.
 */
export interface AccountUpsertInput {
  role: AccountRole;
  loginId: string;
  displayName: string;
  personaCode?: string;
}

export interface AccountView {
  accountId: string;
  role: AccountRole;
  loginId: string;
  displayName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAccountInput(value: unknown): AccountUpsertInput {
  if (!isRecord(value)) throw new Error("계정 정보가 없습니다.");
  if (value.role !== "user" && value.role !== "influencer") {
    throw new Error("계정 역할이 올바르지 않습니다.");
  }
  const loginId = typeof value.loginId === "string" ? value.loginId.trim() : "";
  const displayName =
    typeof value.displayName === "string" ? value.displayName.trim() : "";
  if (!loginId) throw new Error("로그인 아이디가 없습니다.");
  if (!displayName) throw new Error("표시 이름이 없습니다.");

  return {
    role: value.role,
    loginId,
    displayName,
    personaCode:
      typeof value.personaCode === "string" && value.personaCode.trim()
        ? value.personaCode.trim()
        : undefined,
  };
}

export async function upsertAccount(
  authUserId: string,
  input: AccountUpsertInput,
  client = supabaseAdmin(),
): Promise<AccountView> {
  const existing = await client
    .from("accounts")
    .select("id, role, dummy_login_id, display_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (existing.error) {
    console.error("[BiasFit 계정] 조회 실패", existing.error);
    throw new Error("계정 정보를 확인하지 못했어요.");
  }
  if (existing.data) {
    const row = existing.data as {
      id: string;
      role: AccountRole;
      dummy_login_id: string;
      display_name: string;
    };
    return {
      accountId: row.id,
      role: row.role,
      loginId: row.dummy_login_id,
      displayName: row.display_name,
    };
  }

  const inserted = await client
    .from("accounts")
    .insert({
      auth_user_id: authUserId,
      role: input.role,
      dummy_login_id: input.loginId,
      display_name: input.displayName,
      persona_code: input.personaCode ?? null,
      status: "active",
      last_login_at: new Date().toISOString(),
    })
    .select("id, role, dummy_login_id, display_name")
    .single();

  if (inserted.error) {
    // 원문에는 접속 정보가 섞일 수 있다. 서버 로그로만 남긴다.
    console.error("[BiasFit 계정] 생성 실패", inserted.error);
    if (inserted.error.code === "23505") {
      throw new AuthError("이미 사용 중인 로그인 아이디예요.", 409);
    }
    throw new Error("계정을 만들지 못했어요.");
  }

  const row = inserted.data as {
    id: string;
    role: AccountRole;
    dummy_login_id: string;
    display_name: string;
  };
  return {
    accountId: row.id,
    role: row.role,
    loginId: row.dummy_login_id,
    displayName: row.display_name,
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const { authUserId } = await requireAuthUser(request);
    const input = validateAccountInput(readJsonBody(request));
    response.status(200).json(await upsertAccount(authUserId, input));
  } catch (error) {
    console.error("[BiasFit 계정] accounts/upsert failed", error);
    sendAuthAwareError(response, error);
  }
}
