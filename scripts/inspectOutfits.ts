/**
 * 전달된 코디 카드와 링크 검사 결과를 확인한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectOutfits.ts
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

const one = (v: any) => (Array.isArray(v) ? v[0] : v);

const cards = await client
  .from("outfit_cards")
  .select(
    `id, match_result_id, coaching_type, title, status, review_status, delivered_at,
     message_to_user,
     accounts!inner ( dummy_login_id ),
     influencer_profiles!inner ( display_name ),
     tpo:diagnosis_options!outfit_cards_representative_tpo_option_id_fkey ( code ),
     bmin:diagnosis_options!outfit_cards_budget_min_option_id_fkey ( code ),
     bmax:diagnosis_options!outfit_cards_budget_max_option_id_fkey ( code ),
     strategy:diagnosis_options!outfit_cards_budget_strategy_option_id_fkey ( code ),
     outfit_card_items ( item_type, item_name, product_url, final_url, link_check_status, sort_order ),
     match_results!inner ( status ),
     request_cards!inner ( status )`,
  )
  .order("created_at", { ascending: true });

if (cards.error) {
  console.error("조회 실패:", cards.error.message);
  process.exit(1);
}

const rows = (cards.data ?? []) as Array<Record<string, any>>;
console.log(`코디 카드 ${rows.length}장\n`);

for (const row of rows) {
  const receiver = one(row.accounts)?.dummy_login_id ?? "?";
  const writer = one(row.influencer_profiles)?.display_name ?? "?";
  console.log(`  "${row.title}"  (${row.coaching_type})`);
  console.log(`    ${writer} → ${receiver}`);
  console.log(`    status=${row.status}  review_status=${row.review_status}`);
  console.log(`    match_results.status=${one(row.match_results)?.status}`);
  console.log(`    request_cards.status=${one(row.request_cards)?.status}`);
  console.log(
    `    TPO=${one(row.tpo)?.code}  예산=${one(row.bmin)?.code}~${one(row.bmax)?.code}  ${one(row.strategy)?.code}`,
  );
  const items = ((row.outfit_card_items ?? []) as Array<Record<string, any>>).sort(
    (l, r) => l.sort_order - r.sort_order,
  );
  for (const item of items) {
    console.log(
      `      ${item.item_type}: ${item.item_name} · ${item.product_url} · link=${item.link_check_status}`,
    );
  }
  console.log("");
}

const orphan = await client
  .from("outfit_cards")
  .select("id")
  .neq("review_status", "pass")
  .limit(5);
console.log(
  `검수를 통과하지 않은 카드 ${(orphan.data ?? []).length}건 (0이어야 한다 — pass일 때만 저장한다)`,
);
