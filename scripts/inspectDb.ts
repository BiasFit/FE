/**
 * Supabase 현재 상태 점검. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectDb.ts
 *
 * tsconfig 범위 밖이라 브라우저 번들에 들어가지 않는다.
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

const tables = [
  "accounts",
  "diagnosis_options",
  "influencer_profiles",
  "influencer_profile_styles",
  "influencer_fit_concerns",
  "influencer_tpos",
  "diagnosis_sessions",
  "session_members",
  "member_style_inputs",
  "member_style_input_options",
  "selected_tpos",
  "group_infos",
  "style_dna_jobs",
  "style_dna_results",
  "member_style_dna_summaries",
  "style_scores",
  "style_score_breakdowns",
  "match_results",
  "match_recommended_influencers",
  "match_score_breakdowns",
  "request_cards",
  "outfit_cards",
  "outfit_card_items",
  "group_outfit_member_notes",
  "test_results",
];

console.log("테이블별 행 수");
for (const table of tables) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  console.log(`  ${table.padEnd(32)} ${error ? `오류: ${error.code ?? error.message}` : count}`);
}

const tpoCheck = await client.from("influencer_tpos").select("influencer_profile_id");
if (!tpoCheck.error) {
  const perProfile = new Map<string, number>();
  for (const row of tpoCheck.data as Array<{ influencer_profile_id: string }>) {
    perProfile.set(row.influencer_profile_id, (perProfile.get(row.influencer_profile_id) ?? 0) + 1);
  }
  const wrong = [...perProfile].filter(([, count]) => count !== 3);
  console.log(
    `\n강점 TPO가 정확히 3개가 아닌 프로필: ${wrong.length}개 ${wrong.length ? JSON.stringify(wrong) : "(정상)"}`,
  );
}
