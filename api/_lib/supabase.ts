import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

function requiredEnvironment(
  name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
) {
  const value =
    typeof process === "undefined" ? undefined : process.env?.[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return value;
}

/**
 * service role 키를 쓰므로 서버에서만 호출한다.
 * 이 모듈을 src/** 에서 import하면 키가 브라우저 번들에 들어간다. api/** 에서만 쓴다.
 */
export function supabaseAdmin(): SupabaseClient {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
