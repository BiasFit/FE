/**
 * 부탁해요 카드와 수신 한도 상태를 확인한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectRequests.ts
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

const cards = await client
  .from("request_cards")
  .select(
    `id, status, sent_at, message_text,
     writer:accounts!request_cards_writer_account_id_fkey ( dummy_login_id ),
     receiver:influencer_profiles!inner (
       max_received_request_count,
       accounts!inner ( dummy_login_id )
     )`,
  )
  .order("created_at", { ascending: true });

if (cards.error) {
  console.error("조회 실패:", cards.error.message);
  process.exit(1);
}

const rows = (cards.data ?? []) as Array<Record<string, any>>;
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

console.log(`부탁해요 카드 ${rows.length}장\n`);
const counts = new Map<string, { sent: number; limit: number }>();

for (const row of rows) {
  const receiver = one(row.receiver);
  const receiverId = one(receiver?.accounts)?.dummy_login_id ?? "?";
  const writerId = one(row.writer)?.dummy_login_id ?? "?";
  console.log(`  ${writerId} → ${receiverId}  [${row.status}]`);
  console.log(`    "${String(row.message_text).slice(0, 40)}..."`);

  if (row.status === "sent" || row.status === "read") {
    const current = counts.get(receiverId) ?? {
      sent: 0,
      limit: receiver?.max_received_request_count ?? 3,
    };
    current.sent += 1;
    counts.set(receiverId, current);
  }
}

console.log("\n수신 수 / 한도 (sent + read만 셈)");
if (counts.size === 0) console.log("  없음");
for (const [id, { sent, limit }] of counts) {
  console.log(`  ${id}  ${sent} / ${limit} ${sent >= limit ? "← 한도 도달, 후보에서 제외됨" : ""}`);
}
