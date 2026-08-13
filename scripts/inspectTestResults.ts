/**
 * 폐기 예정인 test_results의 내용을 확인한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectTestResults.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

const env = {
  ...Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
      }),
  ),
  ...process.env,
};

const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client
  .from("test_results")
  .select("*")
  .order("created_at", { ascending: true });

if (error) {
  console.error("조회 실패:", error.message);
  process.exit(1);
}

const rows = data as Array<Record<string, any>>;
console.log(`test_results 행 ${rows.length}개\n`);

for (const row of rows) {
  console.log("─".repeat(58));
  console.log(`created_at    ${row.created_at}`);
  console.log(`mode/priority ${row.mode} / ${row.priority}`);
  console.log(`tpo           ${row.tpo}`);
  console.log(`anon_user_key ${row.anon_user_key}`);
  console.log(`account_id    ${row.account_id ?? "없음"}`);
  const members = row.input_json?.members ?? [];
  console.log(
    `members       ${members.map((m: any) => `${m.memberId}(${m.form?.personaId})`).join(" / ")}`,
  );
  const dna = row.ai_result_json?.styleDna;
  console.log(`styleDna      ${dna?.personalStyleDnaSummary ?? dna?.groupStyleDnaSummary ?? "없음"}`);
  const ranked = row.score_result_json?.rankedInfluencers ?? [];
  console.log(
    `TOP 3         ${ranked.map((r: any) => `${r.influencerId} ${r.breakdown?.matchScore}%`).join(" / ")}`,
  );
}

console.log("\n" + "─".repeat(58));
console.log("정규화 테이블에 같은 성격의 기록이 있는지 대조");

const sessions = await client
  .from("diagnosis_sessions")
  .select("id, coaching_type, matching_priority_code, created_at, accounts!inner(dummy_login_id)")
  .order("created_at", { ascending: true });

for (const session of ((sessions.data ?? []) as Array<Record<string, any>>)) {
  const account = Array.isArray(session.accounts) ? session.accounts[0] : session.accounts;
  console.log(
    `  ${session.coaching_type}/${session.matching_priority_code} · 계정=${account?.dummy_login_id} · ${session.created_at}`,
  );
}
