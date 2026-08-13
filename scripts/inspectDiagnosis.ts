/**
 * 마지막 진단 세션이 화면 값과 일치하는지 대조한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectDiagnosis.ts
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

const session = await client
  .from("diagnosis_sessions")
  .select("id, coaching_type, matching_priority_code, status, account_id, created_at")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (session.error || !session.data) {
  console.error("진단 세션이 없습니다.", session.error?.message ?? "");
  process.exit(1);
}

const row = session.data as Record<string, string>;
console.log(`세션 ${row.id}`);
console.log(`  유형=${row.coaching_type} 우선순위=${row.matching_priority_code} 상태=${row.status}`);

const account = await client
  .from("accounts")
  .select("dummy_login_id, role")
  .eq("id", row.account_id)
  .maybeSingle();
console.log(`  계정=${(account.data as Record<string, string> | null)?.dummy_login_id} (${(account.data as Record<string, string> | null)?.role})`);

const tpo = await client
  .from("selected_tpos")
  .select("scope, diagnosis_options!inner(option_group, code, label)")
  .eq("diagnosis_session_id", row.id);
for (const item of (tpo.data ?? []) as Array<Record<string, any>>) {
  const option = Array.isArray(item.diagnosis_options) ? item.diagnosis_options[0] : item.diagnosis_options;
  console.log(`  TPO: code=${option.code} label=${option.label} (scope=${item.scope})`);
}

const members = await client
  .from("session_members")
  .select("id, member_label, persona_code")
  .eq("diagnosis_session_id", row.id)
  .order("member_order");
for (const member of (members.data ?? []) as Array<Record<string, string>>) {
  const input = await client
    .from("member_style_inputs")
    .select("height_cm, body_type_option_id, preferred_style_option_id, budget_strategy_option_id")
    .eq("session_member_id", member.id)
    .maybeSingle();
  const ids = input.data as Record<string, string> | null;
  if (!ids) continue;
  const labels = await client
    .from("diagnosis_options")
    .select("id, option_group, code")
    .in("id", [ids.body_type_option_id, ids.preferred_style_option_id, ids.budget_strategy_option_id]);
  const byId = new Map(
    ((labels.data ?? []) as Array<Record<string, string>>).map((option) => [option.id, `${option.option_group}=${option.code}`]),
  );
  console.log(`  구성원 ${member.member_label} (${member.persona_code}) 키=${ids.height_cm}`);
  console.log(`    ${byId.get(ids.body_type_option_id)}`);
  console.log(`    ${byId.get(ids.preferred_style_option_id)}`);
  console.log(`    ${byId.get(ids.budget_strategy_option_id)}`);
}

const dna = await client
  .from("style_dna_results")
  .select("id, result_type, summary_text, group_combination_score, safety_notice")
  .eq("diagnosis_session_id", row.id)
  .maybeSingle();
const dnaRow = dna.data as Record<string, unknown> | null;
console.log(`  Style DNA: ${dnaRow?.summary_text}`);
console.log(`    조합도=${dnaRow?.group_combination_score ?? "없음(개인)"}`);

const scores = await client
  .from("style_scores")
  .select("score, rank, level, diagnosis_options!inner(code)")
  .eq("style_dna_result_id", dnaRow?.id as string)
  .order("rank");
console.log("  스타일 점수:");
for (const item of (scores.data ?? []) as Array<Record<string, any>>) {
  const option = Array.isArray(item.diagnosis_options) ? item.diagnosis_options[0] : item.diagnosis_options;
  console.log(`    ${item.rank}. ${option.code} ${item.score} (level=${item.level})`);
}

const match = await client
  .from("match_results")
  .select("id, scoring_profile_code, status")
  .eq("diagnosis_session_id", row.id)
  .maybeSingle();
const matchRow = match.data as Record<string, string> | null;
console.log(`  매칭 결과 ${matchRow?.id} (${matchRow?.scoring_profile_code}, ${matchRow?.status})`);

const recommended = await client
  .from("match_recommended_influencers")
  .select("rank, match_score, reason_text, influencer_profiles!inner(display_name)")
  .eq("match_result_id", matchRow?.id as string)
  .order("rank");
for (const item of (recommended.data ?? []) as Array<Record<string, any>>) {
  const profile = Array.isArray(item.influencer_profiles) ? item.influencer_profiles[0] : item.influencer_profiles;
  console.log(`    TOP ${item.rank} ${profile.display_name} ${item.match_score}%`);
  console.log(`      "${String(item.reason_text).slice(0, 45)}..."`);
}
