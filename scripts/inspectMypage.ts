/**
 * 마이페이지 조회 결과를 실제 데이터로 확인한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectMypage.ts            (testuser01)
 *   cd FE && npx vite-node scripts/inspectMypage.ts new_semester
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { loadMypageOverview } from "../api/_routes/mypage/overview.js";

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code: number): never;
};

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

const loginId = "testuser01";
const tpoCode = process.argv[2] ?? null;

const account = await client
  .from("accounts")
  .select("id, dummy_login_id, display_name")
  .eq("dummy_login_id", loginId)
  .maybeSingle();

if (account.error || !account.data) {
  console.error(`${loginId} 계정을 찾지 못했습니다.`);
  process.exit(1);
}

const row = account.data as { id: string; dummy_login_id: string; display_name: string };

const overview = await loadMypageOverview(
  { accountId: row.id, loginId: row.dummy_login_id, displayName: row.display_name },
  tpoCode,
  client as never,
);

console.log(`${overview.displayName} (${overview.loginId})`);
console.log(tpoCode ? `TPO 필터: ${tpoCode}\n` : "TPO 필터: 없음 (전체)\n");

console.log("요약");
console.log(`  받은 코디 카드  ${overview.summary.outfitCardCount}건`);
console.log(`  진단 횟수       ${overview.summary.diagnosisCount}회`);
console.log(`  최근 활동일     ${overview.summary.lastActivityAt ?? "없음"}\n`);

console.log(`코디 카드 도착 ${overview.outfits.length}건`);
for (const card of overview.outfits) {
  console.log(`  "${card.title}" · ${card.tpoLabel} · ${card.influencerName} · ${card.deliveredAt}`);
}

console.log(`\n코디 카드 준비 중 ${overview.pending.length}건`);
for (const item of overview.pending) {
  console.log(`  ${item.influencerName ?? "매칭 전"} · ${item.tpoLabel} · 전송 ${item.requestSentAt}`);
  console.log(`    "${item.requestMessage.slice(0, 40)}..."`);
}

console.log(`\n진단 기록 ${overview.diagnoses.length}건`);
for (const item of overview.diagnoses) {
  const who = item.selectedInfluencerName ?? "매칭 전";
  console.log(`  ${item.diagnosedAt.slice(0, 16)} · ${item.coachingType} · ${item.tpoLabel} · ${who}`);
  console.log(`    ${item.styleDnaSummary.slice(0, 40)} [${item.styleTags.join(", ")}]`);
}
