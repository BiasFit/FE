import { createClient } from "@supabase/supabase-js";

/**
 * 브라우저용 Supabase 클라이언트다. **anon key만 쓴다.**
 *
 * ⚠️ `api/_lib/supabase.ts`와 혼동하지 마라. 그쪽은 service_role 키를 쓰는 서버 전용이고,
 * 여기서 import하면 키가 브라우저 번들에 박혀 누구나 꺼낼 수 있다.
 *
 * anon key는 공개돼도 안전한 키다. 이것만 `VITE_` 접두사를 붙인다.
 * 이 클라이언트가 하는 일은 로그인·로그아웃·세션 유지뿐이고,
 * 데이터 읽기·쓰기는 전부 `/api/**`를 거친다 (PLAN.MD 3.3).
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isAuthConfigured = Boolean(url && anonKey);

if (!isAuthConfigured && import.meta.env.DEV) {
  console.warn(
    "[BiasFit] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 없습니다. 로그인이 동작하지 않습니다.",
  );
}

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "anon", {
  auth: { persistSession: true, autoRefreshToken: true },
});

/**
 * 이 서비스는 실제 이메일을 받지 않는다 (README Data Safety, DB_SCHEMA.md 6장).
 * 화면에서는 테스트용 로그인 아이디만 입력받고, Supabase Auth에 넘길 때만
 * 고정 도메인을 붙여 이메일 형태로 만든다. 계정 식별자는 `accounts.dummy_login_id`다.
 */
export const TEST_EMAIL_DOMAIN = "biasfit.test";

export function loginIdToEmail(loginId: string) {
  const trimmed = loginId.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${TEST_EMAIL_DOMAIN}`;
}
