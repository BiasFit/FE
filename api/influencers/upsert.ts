import { budgetApproaches, isTpoCode } from "../../src/data/options";
import { STYLE_NAMES } from "../../src/domain/scoring";
import { requireAccount, requireRole, sendAuthAwareError } from "../_lib/auth";
import { loadOptionLookup } from "../_lib/options";
import { supabaseAdmin } from "../_lib/supabase";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/**
 * 인플루언서 첫 프로필을 만든다 (DB_SCHEMA.md 5.15~5.18).
 *
 * 여기서 막지 못한 잘못된 어휘는 매칭에서 조용히 0점이 된다.
 * 그래서 저장 전에 전부 검사한다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

/** 강점 TPO는 정확히 3개다 (STYLE_SCORING_DRAFT.md 2.4). */
export const REQUIRED_TPO_COUNT = 3;
/** 자주 다루는 핏 고민은 1~3개 (Change Set 2026-08-02, 9행). */
export const MIN_FIT_CONCERNS = 1;
export const MAX_FIT_CONCERNS = 3;

export interface InfluencerProfileInput {
  primaryStyle: string;
  secondaryStyle: string;
  bodyType: string;
  fitConcerns: string[];
  budgetMinCode: number;
  budgetMaxCode: number;
  budgetApproach: string;
  tpos: string[];
  coachingType: "personal_only" | "group_only" | "both";
  representativeMood?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function validateProfileInput(value: unknown): InfluencerProfileInput {
  if (!isRecord(value)) throw new Error("프로필 정보가 없습니다.");

  const primaryStyle = String(value.primaryStyle ?? "");
  const secondaryStyle = String(value.secondaryStyle ?? "");
  if (!STYLE_NAMES.includes(primaryStyle as never) || !STYLE_NAMES.includes(secondaryStyle as never)) {
    throw new Error("대표 스타일이 올바르지 않습니다.");
  }
  if (primaryStyle === secondaryStyle) {
    throw new Error("대표 스타일 1순위와 2순위는 달라야 합니다.");
  }

  const bodyType = String(value.bodyType ?? "");
  if (bodyType !== "스트레이트" && bodyType !== "웨이브" && bodyType !== "내추럴") {
    throw new Error("체형 유형이 올바르지 않습니다.");
  }

  const fitConcerns = stringList(value.fitConcerns);
  if (fitConcerns.length < MIN_FIT_CONCERNS || fitConcerns.length > MAX_FIT_CONCERNS) {
    throw new Error(`자주 다루는 핏 고민은 ${MIN_FIT_CONCERNS}~${MAX_FIT_CONCERNS}개여야 합니다.`);
  }
  if (new Set(fitConcerns).size !== fitConcerns.length) {
    throw new Error("같은 핏 고민을 두 번 고를 수 없습니다.");
  }

  const budgetMinCode = Number(value.budgetMinCode);
  const budgetMaxCode = Number(value.budgetMaxCode);
  if (!Number.isInteger(budgetMinCode) || !Number.isInteger(budgetMaxCode)) {
    throw new Error("제안 가능한 가격대가 올바르지 않습니다.");
  }
  if (budgetMinCode > budgetMaxCode) {
    throw new Error("최소 예산이 최대 예산보다 클 수 없습니다.");
  }

  const budgetApproach = String(value.budgetApproach ?? "");
  if (!budgetApproaches.includes(budgetApproach as never)) {
    throw new Error("예산 접근 방식이 올바르지 않습니다.");
  }

  const tpos = stringList(value.tpos);
  if (tpos.length !== REQUIRED_TPO_COUNT) {
    throw new Error(`강점 TPO는 정확히 ${REQUIRED_TPO_COUNT}개여야 합니다.`);
  }
  if (new Set(tpos).size !== tpos.length) {
    throw new Error("같은 TPO를 두 번 고를 수 없습니다.");
  }
  for (const code of tpos) {
    // 한글 라벨이 섞이면 TPO 적합도가 항상 0점이 된다.
    if (!isTpoCode(code)) throw new Error(`TPO 코드가 올바르지 않습니다: "${code}"`);
  }

  const coachingType = value.coachingType;
  if (
    coachingType !== "personal_only" &&
    coachingType !== "group_only" &&
    coachingType !== "both"
  ) {
    throw new Error("지원 코칭 유형이 올바르지 않습니다.");
  }

  return {
    primaryStyle,
    secondaryStyle,
    bodyType,
    fitConcerns,
    budgetMinCode,
    budgetMaxCode,
    budgetApproach,
    tpos,
    coachingType,
    representativeMood:
      typeof value.representativeMood === "string" && value.representativeMood.trim()
        ? value.representativeMood.trim()
        : undefined,
  };
}

export async function upsertInfluencerProfile(
  account: { accountId: string; displayName: string },
  input: InfluencerProfileInput,
  client: Client = supabaseAdmin(),
): Promise<{ id: string }> {
  const options = await loadOptionLookup(client);

  const existing = await client
    .from("influencer_profiles")
    .select("id")
    .eq("account_id", account.accountId)
    .maybeSingle();
  if (existing.error) {
    console.error("[BiasFit 프로필] 조회 실패", existing.error);
    throw new Error("프로필 정보를 확인하지 못했어요.");
  }

  const row = {
    account_id: account.accountId,
    display_name: account.displayName,
    representative_mood: input.representativeMood ?? null,
    body_type_option_id: options.id("body_type", input.bodyType),
    budget_min_option_id: options.id("budget_range", input.budgetMinCode),
    budget_max_option_id: options.id("budget_range", input.budgetMaxCode),
    budget_strategy_option_id: options.id("budget_strategy", input.budgetApproach),
    coaching_support_type: input.coachingType,
    profile_status: "completed",
    is_sample_data: false,
    completed_at: new Date().toISOString(),
  };

  let profileId: string;
  if (existing.data) {
    profileId = (existing.data as { id: string }).id;
    const update = await client.from("influencer_profiles").update(row).eq("id", profileId);
    if (update.error) {
      console.error("[BiasFit 프로필] 수정 실패", update.error);
      throw new Error("프로필을 저장하지 못했어요.");
    }
    // 자식 행은 지우고 다시 넣는다. 부분 갱신은 개수 규칙을 깨기 쉽다.
    for (const table of [
      "influencer_profile_styles",
      "influencer_fit_concerns",
      "influencer_tpos",
    ]) {
      const cleanup = await client.from(table).delete().eq("influencer_profile_id", profileId);
      if (cleanup.error) {
        console.error(`[BiasFit 프로필] ${table} 정리 실패`, cleanup.error);
        throw new Error("프로필을 저장하지 못했어요.");
      }
    }
  } else {
    const inserted = await client
      .from("influencer_profiles")
      .insert(row)
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      console.error("[BiasFit 프로필] 생성 실패", inserted.error);
      throw new Error("프로필을 저장하지 못했어요.");
    }
    profileId = (inserted.data as { id: string }).id;
  }

  const children: Array<[string, Array<Record<string, unknown>>]> = [
    [
      "influencer_profile_styles",
      [
        {
          influencer_profile_id: profileId,
          style_option_id: options.id("style_type", input.primaryStyle),
          style_rank: 1,
        },
        {
          influencer_profile_id: profileId,
          style_option_id: options.id("style_type", input.secondaryStyle),
          style_rank: 2,
        },
      ],
    ],
    [
      "influencer_fit_concerns",
      input.fitConcerns.map((concern, index) => ({
        influencer_profile_id: profileId,
        fit_concern_option_id: options.id("fit_concern", concern),
        sort_order: index + 1,
      })),
    ],
    [
      "influencer_tpos",
      input.tpos.map((code, index) => ({
        influencer_profile_id: profileId,
        tpo_option_id: options.id("tpo", code),
        sort_order: index + 1,
      })),
    ],
  ];

  for (const [table, rows] of children) {
    const { error } = await client.from(table).insert(rows);
    if (error) {
      console.error(`[BiasFit 프로필] ${table} 저장 실패`, error);
      throw new Error("프로필을 저장하지 못했어요.");
    }
  }

  return { id: profileId };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = requireRole(await requireAccount(request), "influencer");
    const input = validateProfileInput(readJsonBody(request));
    response.status(200).json(await upsertInfluencerProfile(account, input));
  } catch (error) {
    console.error("[BiasFit 프로필] influencers/upsert failed", error);
    sendAuthAwareError(response, error);
  }
}
