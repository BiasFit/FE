/**
 * 샘플 인플루언서 8명 시드 SQL을 stdout으로 뱉는다.
 *
 *   cd FE && npx vite-node scripts/generateInfluencerSeed.ts > schema/10_influencer_seed.sql
 *
 * 손으로 쓰지 않는다. `src/data/influencers.ts`를 읽어 생성한다.
 * 어휘가 한 글자라도 어긋나면 오류 없이 매칭 점수만 0점이 된다.
 *
 * option_id는 리터럴 uuid가 아니라 (option_group, code) 조회로 넣는다.
 * 그래야 시드를 다시 돌려도 같은 결과가 나오고, 코드가 없으면 not null 위반으로 즉시 드러난다.
 */
import { influencers } from "../src/data/influencers";

declare const process: { stdout: { write(text: string): unknown } };

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

/** (option_group, code)로 diagnosis_options.id를 찾는 스칼라 서브쿼리. */
function optionId(group: string, code: string | number) {
  return `(select id from public.diagnosis_options where option_group = ${quote(group)} and code = ${quote(String(code))})`;
}

const lines: string[] = [
  "-- 10. 샘플 인플루언서 8명 시드",
  "--",
  "-- 생성물이다. 직접 고치지 마라.",
  "-- 출처: FE/src/data/influencers.ts",
  "-- 재생성: cd FE && npx vite-node scripts/generateInfluencerSeed.ts > schema/10_influencer_seed.sql",
  "--",
  "-- 이 시드가 없으면 influencer_profiles가 비어 있어 TOP 3가 나오지 않는다.",
  "-- 여러 번 실행해도 안전하다 (on conflict do nothing).",
  "",
  "-- 1) 계정. 팀이 만든 샘플이라 auth_user_id는 비운다 (is_sample_data와 같은 취지).",
  "insert into public.accounts (role, dummy_login_id, display_name, status)",
  "values",
];

lines.push(
  influencers
    .map((item) => `  ('influencer', ${quote(item.id)}, ${quote(item.name)}, 'active')`)
    .join(",\n") + "\non conflict (dummy_login_id) do nothing;",
  "",
  "-- 2) 매칭용 프로필",
);

for (const item of influencers) {
  const budgetMin = Math.min(...item.budgetCodes);
  const budgetMax = Math.max(...item.budgetCodes);
  lines.push(
    `insert into public.influencer_profiles (`,
    `  account_id, display_name, profile_image_url, representative_mood,`,
    `  body_type_option_id, budget_min_option_id, budget_max_option_id, budget_strategy_option_id,`,
    `  coaching_support_type, max_received_request_count, profile_status, is_sample_data, completed_at)`,
    `select a.id, ${quote(item.name)}, ${quote(`/assets/influencers/${item.id}.jpg`)}, ${quote(item.tagline)},`,
    `  ${optionId("body_type", item.bodyType)},`,
    `  ${optionId("budget_range", budgetMin)},`,
    `  ${optionId("budget_range", budgetMax)},`,
    `  ${optionId("budget_strategy", item.budgetApproach)},`,
    `  ${quote(item.coachingType)}, 3, 'completed', true, now()`,
    `from public.accounts a where a.dummy_login_id = ${quote(item.id)}`,
    `on conflict (account_id) do nothing;`,
    "",
  );
}

lines.push("-- 3) 대표 스타일 1·2순위");
for (const item of influencers) {
  for (const [rank, style] of [
    [1, item.primaryStyle],
    [2, item.secondaryStyle],
  ] as const) {
    lines.push(
      `insert into public.influencer_profile_styles (influencer_profile_id, style_option_id, style_rank)`,
      `select p.id, ${optionId("style_type", style)}, ${rank}`,
      `from public.influencer_profiles p join public.accounts a on a.id = p.account_id`,
      `where a.dummy_login_id = ${quote(item.id)}`,
      `on conflict (influencer_profile_id, style_rank) do nothing;`,
    );
  }
}
lines.push("");

lines.push("-- 4) 자주 다루는 핏 고민 (프로필당 1~3개)");
for (const item of influencers) {
  item.fitConcerns.forEach((concern, index) => {
    lines.push(
      `insert into public.influencer_fit_concerns (influencer_profile_id, fit_concern_option_id, sort_order)`,
      `select p.id, ${optionId("fit_concern", concern)}, ${index + 1}`,
      `from public.influencer_profiles p join public.accounts a on a.id = p.account_id`,
      `where a.dummy_login_id = ${quote(item.id)}`,
      `on conflict (influencer_profile_id, fit_concern_option_id) do nothing;`,
    );
  });
}
lines.push("");

lines.push("-- 5) 강점 TPO (프로필당 정확히 3개, 내부 코드만)");
for (const item of influencers) {
  item.tpos.forEach((tpo, index) => {
    lines.push(
      `insert into public.influencer_tpos (influencer_profile_id, tpo_option_id, sort_order)`,
      `select p.id, ${optionId("tpo", tpo)}, ${index + 1}`,
      `from public.influencer_profiles p join public.accounts a on a.id = p.account_id`,
      `where a.dummy_login_id = ${quote(item.id)}`,
      `on conflict (influencer_profile_id, tpo_option_id) do nothing;`,
    );
  });
}

lines.push(
  "",
  "-- 확인용",
  "-- select count(*) from public.influencer_profiles;                 -- 8",
  "-- select count(*) from public.influencer_profile_styles;           -- 16",
  "-- select count(*) from public.influencer_tpos;                     -- 24",
  "-- 강점 TPO가 3개가 아닌 프로필이 있으면 매칭 규칙 위반이다.",
  "-- select influencer_profile_id, count(*) from public.influencer_tpos group by 1 having count(*) <> 3;",
  "",
);

process.stdout.write(lines.join("\n"));

const tpoCounts = influencers.map((item) => item.tpos.length);
console.error(`인플루언서 ${influencers.length}명`);
console.error(`강점 TPO 개수: ${[...new Set(tpoCounts)].join(", ")} (전부 3이어야 한다)`);
console.error(
  `coaching_support_type: ${[...new Set(influencers.map((item) => item.coachingType))].join(", ")}`,
);
