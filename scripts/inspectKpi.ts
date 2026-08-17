/**
 * MVP 테스트 KPI를 표로 출력한다. 키는 출력하지 않는다.
 *
 *   cd FE && npx vite-node scripts/inspectKpi.ts              # 오늘 (한국 시각)
 *   cd FE && npx vite-node scripts/inspectKpi.ts 2026-08-20   # 특정 날짜
 *   cd FE && npx vite-node scripts/inspectKpi.ts all          # 전체 기간, 날짜별
 *
 * 숫자는 전부 `kpi_daily` 뷰에서 온다 (schema/11_kpi.sql).
 * 읽는 법과 주의할 점은 `MEMO/KPI_조회_가이드.md`에 있다.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
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

/**
 * 뷰의 지표 이름과 순서. **schema/11_kpi.sql과 같아야 한다.**
 * 여기 적어 두는 이유는 그날 한 건도 없는 지표를 0으로 채워 보여주기 위해서다 —
 * 줄이 아예 없으면 "0인지 집계가 깨진 건지" 구분할 수 없다.
 */
const METRICS = [
  "진단 완료",
  "Style DNA 도달",
  "인플루언서 선택",
  "부탁해요 전송",
  "코디 카드 전달",
  "이미지 저장 시도",
  "인플루언서 프로필 완료",
];

interface KpiRow {
  sort_order: number;
  metric: string;
  day: string;
  events: number;
  people: number;
}

function seoulToday() {
  // sv-SE 로케일이 YYYY-MM-DD로 준다. 서버 시간대와 무관하게 한국 날짜가 나온다.
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 한글은 터미널에서 두 칸을 쓴다. 글자 수로 맞추면 표가 어긋난다. */
function width(text: string) {
  let used = 0;
  for (const char of text) used += /[ᄀ-ᇿ　-鿿가-힯]/.test(char) ? 2 : 1;
  return used;
}

function padRight(text: string, size: number) {
  return text + " ".repeat(Math.max(0, size - width(text)));
}

function padLeft(text: string, size: number) {
  return " ".repeat(Math.max(0, size - width(text))) + text;
}

function printDay(day: string, rows: KpiRow[]) {
  const byMetric = new Map(rows.map((row) => [row.metric, row]));
  console.log(`\n${day} (한국 시각)\n`);
  console.log(padRight("지표", 26) + padLeft("건수", 6) + padLeft("인원", 8));
  console.log("-".repeat(40));
  for (const metric of METRICS) {
    const row = byMetric.get(metric);
    console.log(
      padRight(metric, 26) +
        padLeft(String(row?.events ?? 0), 6) +
        padLeft(String(row?.people ?? 0), 8),
    );
  }
  // 뷰에는 있는데 위 목록에 없는 지표. 목록을 갱신하라는 신호다.
  for (const row of rows) {
    if (!METRICS.includes(row.metric)) {
      console.log(padRight(`${row.metric} (목록에 없는 지표)`, 26) + padLeft(String(row.events), 6));
    }
  }
}

const argument = process.argv[2];
const target = argument === "all" ? "all" : (argument ?? seoulToday());

if (target !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
  console.error(`날짜는 2026-08-20 형태로 주세요. 받은 값: "${target}"`);
  process.exit(1);
}

let query = client
  .from("kpi_daily")
  .select("sort_order, metric, day, events, people")
  .order("day", { ascending: false })
  .order("sort_order", { ascending: true });

if (target !== "all") query = query.eq("day", target);

const { data, error } = await query;

if (error) {
  console.error("조회 실패:", error.message);
  if (/kpi_daily/.test(error.message)) {
    console.error("\nschema/11_kpi.sql을 Supabase SQL Editor에서 실행했는지 확인해 주세요.");
  }
  process.exit(1);
}

const rows = (data ?? []) as KpiRow[];

if (target === "all") {
  const days = [...new Set(rows.map((row) => row.day))];
  if (days.length === 0) console.log("아직 기록이 없습니다.");
  for (const day of days) printDay(day, rows.filter((row) => row.day === day));
} else {
  printDay(target, rows);
}

console.log("\n건수 = 몇 번 일어났는가 / 인원 = 몇 명이 했는가 (같은 사람이 두 번 해도 1)");
console.log("읽는 법: MEMO/KPI_조회_가이드.md");
