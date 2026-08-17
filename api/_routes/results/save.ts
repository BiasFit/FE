import { budgetRangeLabel, isTpoCode } from "../../../src/data/options.js";
import { isMatchPriority } from "../../../src/domain/aiContracts.js";
import type { TestResultPayload } from "../../../src/domain/resultSnapshot.js";
import { STYLE_NAMES, styleScoreLevel } from "../../../src/domain/scoring.js";
import { requireAccount, sendAuthAwareError } from "../../_lib/auth.js";
import { loadOptionLookup, type OptionLookup } from "../../_lib/options.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 한 번의 진단 흐름을 정규화 테이블 13개에 나눠 저장한다.
 *
 * 화면에 쓴 값을 그대로 남긴다. 저장을 위해 점수를 다시 계산하거나 OpenAI를 다시 부르지 않는다.
 * 열람할 때도 재계산하지 않는다 (DB_SCHEMA.md 2.1).
 *
 * 여러 테이블에 걸쳐 쓰므로 중간에 실패하면 `diagnosis_sessions` 행을 지운다.
 * 자식 테이블이 전부 on delete cascade라 부분 저장이 남지 않는다.
 */
export interface SavedDiagnosis {
  id: string;
  diagnosisSessionId: string;
  styleDnaResultId: string;
  matchResultId: string;
}

type Client = ReturnType<typeof supabaseAdmin>;

const SAFETY_NOTICE =
  "이 결과는 취향과 핏 기준을 정리한 것이며 외모를 평가하지 않아요.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTestResultPayload(value: unknown): TestResultPayload {
  if (!isRecord(value)) throw new Error("저장할 진단 결과가 없습니다.");
  if (value.mode !== "personal" && value.mode !== "group") {
    throw new Error("진단 유형이 올바르지 않습니다.");
  }
  if (!isMatchPriority(value.priority)) {
    throw new Error("매칭 우선순위가 올바르지 않습니다.");
  }
  if (!isTpoCode(value.tpo)) {
    throw new Error("TPO 코드가 올바르지 않습니다.");
  }
  if (!isRecord(value.input) || !Array.isArray(value.input.members)) {
    throw new Error("진단 입력값이 올바르지 않습니다.");
  }
  const expectedMembers = value.mode === "group" ? 2 : 1;
  if (value.input.members.length !== expectedMembers) {
    throw new Error("진단 입력값의 구성원 수가 올바르지 않습니다.");
  }
  if (!isRecord(value.ai) || !isRecord(value.ai.styleDna)) {
    throw new Error("저장할 AI 결과가 없습니다.");
  }
  if (!isRecord(value.score) || !Array.isArray(value.score.rankedInfluencers)) {
    throw new Error("저장할 점수 결과가 없습니다.");
  }
  return value as unknown as TestResultPayload;
}

/** insert 한 건. 실패하면 짧은 한국어 문구로 바꿔 던진다. */
async function insertOne<T extends Record<string, unknown>>(
  client: Client,
  table: string,
  row: T,
  label: string,
): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select("id").single();
  if (error) {
    console.error(`[BiasFit 저장] ${table} insert 실패`, error);
    throw new Error(`${label}을(를) 저장하지 못했어요.`);
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== "string") throw new Error(`${label}을(를) 저장하지 못했어요.`);
  return id;
}

async function insertMany(
  client: Client,
  table: string,
  rows: Array<Record<string, unknown>>,
  label: string,
) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows);
  if (error) {
    console.error(`[BiasFit 저장] ${table} insert 실패`, error);
    throw new Error(`${label}을(를) 저장하지 못했어요.`);
  }
}

/** `stylemate-01` 같은 화면용 id를 `influencer_profiles.id`로 바꾼다. */
async function influencerProfileIds(client: Client, loginIds: string[]) {
  const { data, error } = await client
    .from("influencer_profiles")
    .select("id, accounts!inner(dummy_login_id)")
    .in("accounts.dummy_login_id", loginIds);

  if (error) {
    console.error("[BiasFit 저장] influencer_profiles 조회 실패", error);
    throw new Error("스타일메이트 정보를 불러오지 못했어요.");
  }

  const rows = (data ?? []) as Array<{
    id: string;
    accounts: { dummy_login_id: string } | Array<{ dummy_login_id: string }>;
  }>;
  const map = new Map<string, string>();
  for (const row of rows) {
    const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    if (account) map.set(account.dummy_login_id, row.id);
  }

  const missing = loginIds.filter((loginId) => !map.has(loginId));
  if (missing.length) {
    // 시드가 없거나 id 규칙이 어긋났다는 뜻이다. 조용히 넘기면 매칭 기록이 사라진다.
    throw new Error(
      `스타일메이트를 찾지 못했어요: ${missing.join(", ")}. 인플루언서 시드가 실행됐는지 확인이 필요합니다.`,
    );
  }
  return map;
}

/** 구성원별 다중 선택값을 `member_style_input_options` 행으로 편다. */
function selectionRows(
  memberStyleInputId: string,
  form: TestResultPayload["input"]["members"][number]["form"],
  options: OptionLookup,
) {
  const groups = [
    ["fit_concern", "fit_concern", form.fitConcerns],
    ["keyword", "keyword", form.keywords],
    ["design_element", "design_element", form.designElements],
    ["preferred_item", "preferred_item", form.preferredItems],
    ["avoid_element", "avoid_element", form.avoidedElements],
  ] as const;

  return groups.flatMap(([group, selectionType, values]) =>
    values.map((value, index) => ({
      member_style_input_id: memberStyleInputId,
      option_id: options.id(group, value),
      selection_type: selectionType,
      sort_order: index + 1,
    })),
  );
}

export async function saveDiagnosis(
  accountId: string,
  input: unknown,
  client: Client = supabaseAdmin(),
): Promise<SavedDiagnosis> {
  const payload = validateTestResultPayload(input);
  const options = await loadOptionLookup(client);
  const isGroup = payload.mode === "group";

  const profileIds = await influencerProfileIds(
    client,
    payload.score.rankedInfluencers.map((item) => item.influencerId),
  );

  let sessionId: string | null = null;
  try {
    // 1) 진단 세션
    sessionId = await insertOne(
      client,
      "diagnosis_sessions",
      {
        account_id: accountId,
        coaching_type: payload.mode,
        matching_priority_code: payload.priority,
        current_step: "completed",
        status: "completed",
        input_version: 1,
      },
      "진단 세션",
    );

    // 2) 구성원과 입력값
    const memberIds = new Map<string, string>();
    for (const [index, member] of payload.input.members.entries()) {
      const memberId = await insertOne(
        client,
        "session_members",
        {
          diagnosis_session_id: sessionId,
          member_label: member.memberId,
          member_order: index + 1,
          // 실제 참가자에게는 페르소나가 없다. 팀 내부 테스트에서만 쓰던 값이라 비워 둔다.
          persona_code: null,
        },
        "구성원",
      );
      memberIds.set(member.memberId, memberId);

      const styleInputId = await insertOne(
        client,
        "member_style_inputs",
        {
          session_member_id: memberId,
          height_cm: member.form.height,
          top_size: member.form.topSize,
          bottom_size: member.form.bottomSize,
          body_type_option_id: options.id("body_type", member.form.bodyType),
          preferred_style_option_id: options.id("style_type", member.form.preferredStyle),
          avoid_style_option_id: options.id("style_type", member.form.avoidedStyle),
          budget_min_option_id: options.id("budget_range", member.form.budgetMinCode),
          budget_max_option_id: options.id("budget_range", member.form.budgetMaxCode),
          budget_strategy_option_id: options.id("budget_strategy", member.form.budgetApproach),
          fit_note: member.form.fitNote || null,
          completed_at: new Date().toISOString(),
        },
        "구성원 입력값",
      );

      await insertMany(
        client,
        "member_style_input_options",
        selectionRows(styleInputId, member.form, options),
        "구성원 선택값",
      );
    }

    // 3) TPO와 그룹 정보
    await insertMany(
      client,
      "selected_tpos",
      [
        {
          diagnosis_session_id: sessionId,
          session_member_id: null,
          tpo_option_id: options.id("tpo", payload.tpo),
          scope: "session",
        },
      ],
      "TPO 선택",
    );

    if (isGroup && payload.input.group) {
      await insertMany(
        client,
        "group_infos",
        [
          {
            diagnosis_session_id: sessionId,
            member_count: 2,
            relationship_option_id: options.id("relationship", payload.input.group.relationship),
            relationship_text: payload.input.group.relationshipOther || null,
            common_tpo_option_id: options.id("tpo", payload.tpo),
          },
        ],
        "그룹 정보",
      );
    }

    // 4) Style DNA
    const jobId = await insertOne(
      client,
      "style_dna_jobs",
      {
        diagnosis_session_id: sessionId,
        input_version: 1,
        status: "completed",
        safety_status: "passed",
        completed_at: new Date().toISOString(),
      },
      "Style DNA 작업",
    );

    const dna = payload.ai.styleDna;
    const group = dna.mode === "group" ? dna.groupCombination : null;
    const styleDnaResultId = await insertOne(
      client,
      "style_dna_results",
      {
        diagnosis_session_id: sessionId,
        style_dna_job_id: jobId,
        result_type: dna.mode,
        summary_text:
          dna.mode === "personal" ? dna.personalStyleDnaSummary : dna.groupStyleDnaSummary,
        // 화면에 쓴 AI 응답 전체를 그대로 남긴다. 열람할 때 다시 만들지 않는다.
        structured_dna: dna,
        matching_points:
          dna.mode === "personal" ? dna.personalMatchingPoints : dna.groupMatchingPoints,
        evidence_refs:
          dna.mode === "personal"
            ? dna.personalStyleDnaSummaryEvidenceRefs
            : dna.groupStyleDnaSummaryEvidenceRefs,
        group_combination_score: payload.score.groupCompatibility?.total ?? null,
        direction_similarity_score: payload.score.groupCompatibility?.styleSimilarity ?? null,
        budget_coordination_score: payload.score.groupCompatibility?.budgetCompatibility ?? null,
        group_combination_title: group?.title ?? null,
        group_combination_description: group?.description ?? null,
        group_combination_evidence_refs: group?.evidenceRefs ?? null,
        safety_notice: SAFETY_NOTICE,
      },
      "Style DNA 결과",
    );

    // 5) 구성원별 요약. AI가 구성원별 문장을 따로 내지 않으므로 입력값을 그대로 정리해 남긴다.
    await insertMany(
      client,
      "member_style_dna_summaries",
      payload.input.members.map((member) => ({
        style_dna_result_id: styleDnaResultId,
        session_member_id: memberIds.get(member.memberId),
        summary_text:
          dna.mode === "personal" ? dna.personalStyleDnaSummary : dna.groupStyleDnaSummary,
        style_tags: topStyleTags(payload, member.memberId),
        fit_summary: member.form.fitConcerns.join(" · ") || null,
        preferred_style_summary: member.form.preferredStyle,
        avoid_style_summary: member.form.avoidedStyle,
        budget_summary: `${budgetRangeLabel(member.form.budgetMinCode, member.form.budgetMaxCode)} · ${member.form.budgetApproach}`,
      })),
      "구성원 요약",
    );

    // 6) 스타일 점수와 항목별 내역
    for (const entry of payload.score.styleScores) {
      const ordered = [...STYLE_NAMES].sort(
        (left, right) => entry.scores[right] - entry.scores[left],
      );
      for (const [index, style] of ordered.entries()) {
        const score = entry.scores[style];
        const styleScoreId = await insertOne(
          client,
          "style_scores",
          {
            style_dna_result_id: styleDnaResultId,
            session_member_id: isGroup ? memberIds.get(entry.memberId) : null,
            style_option_id: options.id("style_type", style),
            score,
            rank: index + 1,
            // 내부 분류다. 화면과 AI 프롬프트에 넘기지 않는다.
            level: styleScoreLevel(score),
            reason_text: reasonTextFor(entry.breakdowns[style] ?? []),
          },
          "스타일 점수",
        );

        await insertMany(
          client,
          "style_score_breakdowns",
          (entry.breakdowns[style] ?? []).map((item) => ({
            style_score_id: styleScoreId,
            criterion_code: item.criterionCode,
            criterion_label: item.criterionLabel,
            score: item.score,
            max_score: item.maxScore,
          })),
          "스타일 점수 근거",
        );
      }
    }

    // 7) 매칭 결과
    const matchResultId = await insertOne(
      client,
      "match_results",
      {
        style_dna_result_id: styleDnaResultId,
        diagnosis_session_id: sessionId,
        account_id: accountId,
        scoring_profile_code: payload.priority,
        status: "recommended",
      },
      "매칭 결과",
    );

    const reasonByInfluencer = new Map(
      payload.ai.matchExplanations.map((item) => [item.influencerId, item.summary]),
    );

    for (const candidate of payload.score.rankedInfluencers) {
      const recommendedId = await insertOne(
        client,
        "match_recommended_influencers",
        {
          match_result_id: matchResultId,
          influencer_profile_id: profileIds.get(candidate.influencerId),
          rank: candidate.rank,
          match_score: candidate.breakdown.matchScore,
          reason_text: reasonByInfluencer.get(candidate.influencerId) ?? "",
        },
        "추천 스타일메이트",
      );

      await insertMany(
        client,
        "match_score_breakdowns",
        matchBreakdownRows(recommendedId, candidate, isGroup),
        "매칭 점수 근거",
      );
    }

    return {
      id: matchResultId,
      diagnosisSessionId: sessionId,
      styleDnaResultId,
      matchResultId,
    };
  } catch (error) {
    // 부분 저장을 남기지 않는다. 자식 테이블은 cascade로 함께 지워진다.
    if (sessionId) {
      const cleanup = await client.from("diagnosis_sessions").delete().eq("id", sessionId);
      if (cleanup.error) {
        console.error("[BiasFit 저장] 실패한 세션 정리 실패", cleanup.error);
      }
    }
    throw error;
  }
}

/** 점수가 높은 순으로 상위 3개 스타일 이름. `member_style_dna_summaries.style_tags`용. */
function topStyleTags(payload: TestResultPayload, memberId: string) {
  const entry = payload.score.styleScores.find((item) => item.memberId === memberId);
  if (!entry) return [];
  return [...STYLE_NAMES]
    .sort((left, right) => entry.scores[right] - entry.scores[left])
    .slice(0, 3);
}

/** 항목별 내역을 사람이 읽는 한 줄로. 점수 숫자와 내부 코드를 쓰지 않는다. */
function reasonTextFor(breakdowns: Array<{ criterionLabel: string; score: number }>) {
  const earned = breakdowns.filter((item) => item.score > 0).map((item) => item.criterionLabel);
  return earned.length ? `${earned.join(", ")}에서 신호가 나타났어요.` : "뚜렷한 신호가 없었어요.";
}

/**
 * `match_score_breakdowns` 행.
 * 개인은 체형·핏을 body_fit_response(15)와 fit_concern_fit(10)으로 나눈다.
 * 그룹은 체형을 점수에 쓰지 않아 fit_concern_fit 하나다 (Change Set 2026-08-02, 10~11행).
 */
function matchBreakdownRows(
  recommendedInfluencerId: string,
  candidate: TestResultPayload["score"]["rankedInfluencers"][number],
  isGroup: boolean,
) {
  const { baseBreakdown, breakdown, fitDetail } = candidate;
  const rows: Array<Record<string, unknown>> = [
    {
      recommended_influencer_id: recommendedInfluencerId,
      criterion_code: "style_fit",
      criterion_label: "스타일 취향 일치도",
      base_max_score: 30,
      applied_max_score: breakdown.style,
      score: Math.round(breakdown.style),
      max_score: breakdown.style,
      evidence: { baseScore: baseBreakdown.style },
    },
  ];

  if (!isGroup && fitDetail) {
    rows.push(
      {
        recommended_influencer_id: recommendedInfluencerId,
        criterion_code: "body_fit_response",
        criterion_label: "체형 유형 대응",
        base_max_score: 15,
        applied_max_score: breakdown.fit * (15 / 25),
        score: fitDetail.bodyFitResponse,
        max_score: breakdown.fit * (15 / 25),
        evidence: { bodyTypeMatched: fitDetail.bodyTypeMatched },
      },
      {
        recommended_influencer_id: recommendedInfluencerId,
        criterion_code: "fit_concern_fit",
        criterion_label: "핏 고민 일치도",
        base_max_score: 10,
        applied_max_score: breakdown.fit * (10 / 25),
        score: fitDetail.fitConcernFit,
        max_score: breakdown.fit * (10 / 25),
        evidence: { matchedConcerns: fitDetail.matchedConcerns },
      },
    );
  } else {
    rows.push({
      recommended_influencer_id: recommendedInfluencerId,
      criterion_code: "fit_concern_fit",
      criterion_label: "핏 고민 일치도",
      base_max_score: 25,
      applied_max_score: breakdown.fit,
      score: Math.round(breakdown.fit),
      max_score: breakdown.fit,
      evidence: { baseScore: baseBreakdown.fit },
    });
  }

  rows.push(
    {
      recommended_influencer_id: recommendedInfluencerId,
      criterion_code: "budget_fit",
      criterion_label: "예산 적합도",
      base_max_score: isGroup ? 15 : 20,
      applied_max_score: breakdown.budget,
      score: Math.round(breakdown.budget),
      max_score: breakdown.budget,
      evidence: { baseScore: baseBreakdown.budget },
    },
    {
      recommended_influencer_id: recommendedInfluencerId,
      criterion_code: "tpo_fit",
      criterion_label: "TPO 적합도",
      base_max_score: isGroup ? 20 : 15,
      applied_max_score: breakdown.tpo,
      score: Math.round(breakdown.tpo),
      max_score: breakdown.tpo,
      evidence: { baseScore: baseBreakdown.tpo },
    },
  );

  return rows;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    // 신원은 토큰에서만 꺼낸다. 프런트가 보낸 계정 id는 믿지 않는다.
    const account = await requireAccount(request);
    response.status(200).json(await saveDiagnosis(account.accountId, readJsonBody(request)));
  } catch (error) {
    console.error("[BiasFit 저장] results/save failed", error);
    sendAuthAwareError(response, error);
  }
}
