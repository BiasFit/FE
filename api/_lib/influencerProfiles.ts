import { budgetRangeLabel, isTpoCode, tpoLabel } from "../../src/data/options.js";
import { STYLE_NAMES, type InfluencerProfile, type StyleName } from "../../src/domain/scoring.js";
import type { StylemateView } from "../../src/data/influencers.js";
import { supabaseAdmin } from "./supabase.js";

/**
 * `influencer_profiles`와 자식 3개를 읽어 매칭 엔진이 쓰는 `InfluencerProfile`로 바꾼다.
 *
 * **어긋난 어휘는 조용히 넘기지 않고 오류를 낸다.** DB에 잘못된 코드가 들어가도
 * 점수만 0점이 되고 아무도 모르던 사고가 이 프로젝트에서 두 번 났다.
 *
 * `id`는 uuid가 아니라 `accounts.dummy_login_id`(`stylemate-01`)를 쓴다.
 * 화면과 저장 payload가 이미 그 값을 쓰고 있어 변환 지점을 늘리지 않는다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

const PROFILE_SELECT = `
  id,
  display_name,
  profile_status,
  coaching_support_type,
  profile_image_url,
  representative_mood,
  accounts!inner ( dummy_login_id ),
  body_type:diagnosis_options!influencer_profiles_body_type_option_id_fkey ( code ),
  budget_min:diagnosis_options!influencer_profiles_budget_min_option_id_fkey ( code ),
  budget_max:diagnosis_options!influencer_profiles_budget_max_option_id_fkey ( code ),
  budget_strategy:diagnosis_options!influencer_profiles_budget_strategy_option_id_fkey ( code ),
  influencer_profile_styles ( style_rank, diagnosis_options ( code ) ),
  influencer_fit_concerns ( sort_order, diagnosis_options ( code ) ),
  influencer_tpos ( sort_order, diagnosis_options ( code ) )
`;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function requireStyle(code: string | undefined, context: string): StyleName {
  if (!code || !STYLE_NAMES.includes(code as StyleName)) {
    throw new Error(`${context}의 스타일 값이 올바르지 않아요: "${code ?? ""}"`);
  }
  return code as StyleName;
}

/** min~max 사이의 예산 구간 코드를 전부 편다. 매칭 엔진이 배열로 받는다. */
function budgetCodesBetween(min: number, max: number) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Array.from({ length: high - low + 1 }, (_, index) => low + index);
}

export function toStylemateView(row: Record<string, any>): StylemateView {
  const account = one<{ dummy_login_id: string }>(row.accounts);
  const loginId = account?.dummy_login_id;
  if (!loginId) throw new Error("스타일메이트 계정 정보를 찾지 못했어요.");

  const styles = (row.influencer_profile_styles ?? []) as Array<{
    style_rank: number;
    diagnosis_options: { code: string } | Array<{ code: string }>;
  }>;
  const styleByRank = new Map(
    styles.map((item) => [item.style_rank, one<{ code: string }>(item.diagnosis_options)?.code]),
  );

  const bodyType = one<{ code: string }>(row.body_type)?.code;
  if (bodyType !== "스트레이트" && bodyType !== "웨이브" && bodyType !== "내추럴") {
    throw new Error(`${loginId}의 체형 유형이 올바르지 않아요: "${bodyType ?? ""}"`);
  }

  const budgetMin = Number(one<{ code: string }>(row.budget_min)?.code);
  const budgetMax = Number(one<{ code: string }>(row.budget_max)?.code);
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax)) {
    throw new Error(`${loginId}의 예산 구간이 올바르지 않아요.`);
  }

  const budgetApproach = one<{ code: string }>(row.budget_strategy)?.code;
  if (!budgetApproach) throw new Error(`${loginId}의 예산 접근 방식이 없어요.`);

  const tpos = ((row.influencer_tpos ?? []) as Array<{
    sort_order: number;
    diagnosis_options: { code: string } | Array<{ code: string }>;
  }>)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((item) => one<{ code: string }>(item.diagnosis_options)?.code ?? "");

  for (const code of tpos) {
    // 라벨(`개강·새학기`)이 섞이면 TPO 적합도가 항상 0점이 된다.
    if (!isTpoCode(code)) {
      throw new Error(`${loginId}의 TPO 코드가 올바르지 않아요: "${code}"`);
    }
  }

  const fitConcerns = ((row.influencer_fit_concerns ?? []) as Array<{
    sort_order: number;
    diagnosis_options: { code: string } | Array<{ code: string }>;
  }>)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((item) => one<{ code: string }>(item.diagnosis_options)?.code ?? "");

  const coachingType = row.coaching_support_type;
  if (
    coachingType !== "personal_only" &&
    coachingType !== "group_only" &&
    coachingType !== "both"
  ) {
    throw new Error(`${loginId}의 지원 코칭 유형이 올바르지 않아요: "${coachingType}"`);
  }

  const profile: InfluencerProfile = {
    id: loginId,
    name: row.display_name,
    profileCompleted: row.profile_status === "completed",
    primaryStyle: requireStyle(styleByRank.get(1), `${loginId} 대표 스타일 1순위`),
    secondaryStyle: requireStyle(styleByRank.get(2), `${loginId} 대표 스타일 2순위`),
    bodyType,
    fitConcerns,
    budgetCodes: budgetCodesBetween(budgetMin, budgetMax),
    budgetApproach: budgetApproach as InfluencerProfile["budgetApproach"],
    tpos: tpos as InfluencerProfile["tpos"],
    coachingType,
  };

  return {
    ...profile,
    // 화면 표시용. DB_SCHEMA.md 5.15에 전용 컬럼이 없어 실제 값에서 만든다.
    // 손으로 쓴 문구보다 정확하고, 프로필이 바뀌면 함께 바뀐다.
    tagline: row.representative_mood ?? row.display_name,
    description: descriptionFor(profile),
    price: `${budgetRangeLabel(budgetMin, budgetMax)}`,
    occasions: profile.tpos.map((code) => tpoLabel(code)).join(" · "),
    // 등록 전에는 null이다. 화면이 중립 배경을 쓰게 그대로 넘긴다 (MEMO/이미지_처리.md).
    profileImageUrl: row.profile_image_url ?? null,
  };
}

/** 대표 스타일과 강점 핏 고민으로 만드는 한 줄 소개. */
function descriptionFor(profile: InfluencerProfile) {
  const styles = `${profile.primaryStyle}과 ${profile.secondaryStyle}`;
  const concerns = profile.fitConcerns.length
    ? `${profile.fitConcerns.join(" · ")} 고민을 함께 살펴요.`
    : "";
  return `${styles} 방향을 다뤄요. ${concerns}`.trim();
}

export async function loadInfluencerProfiles(client: Client = supabaseAdmin()) {
  const { data, error } = await client
    .from("influencer_profiles")
    .select(PROFILE_SELECT)
    .eq("profile_status", "completed");

  if (error) {
    console.error("[BiasFit 매칭] influencer_profiles 조회 실패", error);
    throw new Error("스타일메이트 정보를 불러오지 못했어요.");
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  if (rows.length === 0) {
    // 하드코딩 배열로 폴백하지 않는다. 실패는 실패로 드러나야 한다.
    throw new Error(
      "등록된 스타일메이트가 없어요. 인플루언서 시드가 실행됐는지 확인이 필요합니다.",
    );
  }

  return rows.map(toStylemateView).sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * 인플루언서별 누적 수신 부탁해요 카드 수와 한도를 센다.
 *
 * `status in ('sent','read')`만 센다. `draft`는 전송되지 않았으므로 제외하고,
 * 코디 카드가 전달돼도 같은 요청을 다시 세지 않는다 (DB_SCHEMA.md 5.22).
 *
 * **반드시 서버에서 센다.** 프런트가 보낸 값을 쓰면 한도를 우회할 수 있다.
 */
export async function loadReceivedRequestCounts(client: Client = supabaseAdmin()) {
  const profiles = await client
    .from("influencer_profiles")
    .select("id, max_received_request_count, accounts!inner(dummy_login_id)");

  if (profiles.error) {
    console.error("[BiasFit 매칭] 수신 한도 조회 실패", profiles.error);
    throw new Error("스타일메이트 정보를 불러오지 못했어요.");
  }

  const loginIdByProfile = new Map<string, string>();
  const limits: Record<string, number> = {};
  for (const row of ((profiles.data ?? []) as Array<Record<string, any>>)) {
    const account = one<{ dummy_login_id: string }>(row.accounts);
    if (!account) continue;
    loginIdByProfile.set(row.id, account.dummy_login_id);
    limits[account.dummy_login_id] = row.max_received_request_count;
  }

  const cards = await client
    .from("request_cards")
    .select("receiver_influencer_profile_id")
    .in("status", ["sent", "read"]);

  if (cards.error) {
    console.error("[BiasFit 매칭] 수신 수 집계 실패", cards.error);
    throw new Error("스타일메이트 정보를 불러오지 못했어요.");
  }

  const counts: Record<string, number> = {};
  for (const row of ((cards.data ?? []) as Array<{ receiver_influencer_profile_id: string }>)) {
    const loginId = loginIdByProfile.get(row.receiver_influencer_profile_id);
    if (!loginId) continue;
    counts[loginId] = (counts[loginId] ?? 0) + 1;
  }

  return { counts, limits };
}
