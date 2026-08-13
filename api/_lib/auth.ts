import { supabaseAdmin } from "./supabase.js";
import type { ApiRequest } from "./http.js";

/**
 * 요청자의 신원은 **오직 JWT에서만** 꺼낸다.
 *
 * ⚠️ 프런트가 body에 담아 보낸 accountId를 절대 믿지 마라. 조작할 수 있다.
 * 서버는 항상 여기서 검증한 id로 조회·저장 범위를 좁힌다 (PLAN.MD 3.3).
 */
export type AccountRole = "user" | "influencer";

export interface AuthenticatedAccount {
  /** `accounts.id`. 앱 안에서 쓰는 계정 식별자다. */
  accountId: string;
  /** Supabase Auth의 사용자 id. `accounts.auth_user_id`와 같다. */
  authUserId: string;
  role: AccountRole;
  displayName: string;
  loginId: string;
}

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function bearerToken(request: ApiRequest) {
  const headers = (request as { headers?: Record<string, unknown> }).headers ?? {};
  const raw = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}

/**
 * 토큰만 검증해 Supabase Auth 사용자 id를 돌려준다.
 * 가입 직후에는 아직 `accounts` 행이 없으므로 계정 생성 엔드포인트만 이걸 쓴다.
 */
export async function requireAuthUser(
  request: ApiRequest,
  client = supabaseAdmin(),
): Promise<{ authUserId: string }> {
  const token = bearerToken(request);
  if (!token) throw new AuthError("로그인이 필요합니다.");

  const { data, error } = await client.auth.getUser(token);
  const authUser = data?.user;
  if (error || !authUser) throw new AuthError("로그인이 만료됐어요. 다시 로그인해 주세요.");

  return { authUserId: authUser.id };
}

/**
 * 토큰을 검증하고 그 사용자의 `accounts` 행을 돌려준다.
 * 토큰이 없거나 유효하지 않으면 401, 계정 행이 없으면 403이다.
 */
export async function requireAccount(
  request: ApiRequest,
  client = supabaseAdmin(),
): Promise<AuthenticatedAccount> {
  const { authUserId } = await requireAuthUser(request, client);

  const account = await client
    .from("accounts")
    .select("id, role, display_name, dummy_login_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (account.error) {
    console.error("[BiasFit 인증] accounts 조회 실패", account.error);
    throw new AuthError("계정 정보를 확인하지 못했어요.", 500);
  }
  if (!account.data) {
    throw new AuthError("계정 설정이 끝나지 않았어요.", 403);
  }

  const row = account.data as {
    id: string;
    role: string;
    display_name: string;
    dummy_login_id: string;
  };
  if (row.role !== "user" && row.role !== "influencer") {
    throw new AuthError("계정 역할이 올바르지 않아요.", 403);
  }

  return {
    accountId: row.id,
    authUserId,
    role: row.role,
    displayName: row.display_name,
    loginId: row.dummy_login_id,
  };
}

/** 인플루언서 전용 엔드포인트에서 쓴다. 역할이 다르면 403이다. */
export function requireRole(account: AuthenticatedAccount, role: AccountRole) {
  if (account.role !== role) {
    throw new AuthError("이 기능을 사용할 수 있는 계정이 아니에요.", 403);
  }
  return account;
}

/** `AuthError`는 자기 상태 코드로, 나머지는 400으로 내보낸다. */
export function sendAuthAwareError(
  response: { status(code: number): { json(payload: unknown): void } },
  error: unknown,
) {
  if (error instanceof AuthError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  response.status(400).json({ error: message });
}
