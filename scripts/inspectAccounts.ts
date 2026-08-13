/**
 * 저장된 accounts 행을 확인하는 점검 스크립트다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectAccounts.ts
 *
 * `dev/localApiPlugin.ts`처럼 tsconfig 범위 밖이라 브라우저 번들에 들어가지 않는다.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

function envFromDotEnv() {
  const text = readFileSync(".env", "utf8");
  const entries = text
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
    });
  return Object.fromEntries(entries) as Record<string, string>;
}

const env = { ...envFromDotEnv(), ...process.env };
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client
  .from("accounts")
  .select("id, role, dummy_login_id, display_name, status, auth_user_id, created_at")
  .order("created_at", { ascending: false });

if (error) {
  console.error("조회 실패:", error.message);
  process.exit(1);
}

console.log(`accounts 행 ${data.length}개\n`);
for (const row of data as Array<Record<string, unknown>>) {
  console.log(`- ${row.dummy_login_id} (${row.role}) "${row.display_name}"`);
  console.log(`  id=${row.id}`);
  console.log(`  auth 연결=${row.auth_user_id ? "있음" : "없음"} status=${row.status}`);
}
