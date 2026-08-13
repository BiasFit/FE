import { budgetRangeLabel, tpoLabel } from "../../../src/data/options.js";
import { requireAccount, sendAuthAwareError, AuthError } from "../../_lib/auth.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 저장된 진단 결과를 매칭 1건 기준으로 조립해 돌려준다.
 *
 * 인플루언서 화면이 사용자의 Style DNA와 입력값을 보여줄 때 쓴다.
 * **저장된 스냅샷만 읽는다. 점수·순위·문구를 다시 계산하지 않는다** (DB_SCHEMA.md 2.1).
 *
 * 볼 수 있는 사람은 둘뿐이다 — 진단한 본인, 그리고 그 요청을 받은 인플루언서.
 */
type Client = ReturnType<typeof supabaseAdmin>;

export interface DiagnosisMemberView {
  memberLabel: "self" | "A" | "B";
  personaCode: string | null;
  heightCm: number | null;
  bodyType: string;
  preferredStyle: string;
  avoidedStyle: string;
  budgetLabel: string;
  budgetApproach: string;
  fitConcerns: string[];
  keywords: string[];
  designElements: string[];
  preferredItems: string[];
  avoidedElements: string[];
  fitNote: string | null;
  /** 스타일별 점수. 화면 표시용 (내부 level은 담지 않는다). */
  styleScores: Array<{ style: string; score: number; rank: number }>;
}

/** 사용자가 실제로 쓴 부탁해요 카드. 인플루언서 상세 화면이 그대로 보여준다. */
export interface RequestCardView {
  messageText: string;
  ownedItemsText: string | null;
  avoidText: string | null;
  sentAt: string | null;
}

export interface DiagnosisResultView {
  matchResultId: string;
  coachingType: "personal" | "group";
  priority: string;
  tpoCode: string;
  tpoLabel: string;
  styleDnaSummary: string;
  matchingPoints: Array<{ text: string }>;
  groupCombination: {
    score: number | null;
    title: string | null;
    description: string | null;
  } | null;
  relationship: string | null;
  members: DiagnosisMemberView[];
  selectedInfluencerName: string | null;
  /** 아직 보내지 않았으면 null. */
  requestCard: RequestCardView | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function code(value: unknown) {
  const option = one<{ code: string }>(value as any);
  return option?.code ?? "";
}

export async function loadDiagnosisResult(
  matchResultId: string,
  viewer: { accountId: string; role: "user" | "influencer" },
  client: Client = supabaseAdmin(),
): Promise<DiagnosisResultView> {
  const match = await client
    .from("match_results")
    .select(
      "id, account_id, diagnosis_session_id, style_dna_result_id, scoring_profile_code, selected_influencer_profile_id",
    )
    .eq("id", matchResultId)
    .maybeSingle();

  if (match.error) {
    console.error("[BiasFit 조회] match_results 조회 실패", match.error);
    throw new Error("진단 결과를 불러오지 못했어요.");
  }
  if (!match.data) throw new AuthError("요청한 진단 결과를 찾을 수 없어요.", 404);

  const matchRow = match.data as Record<string, string | null>;

  // 본인 것이거나, 그 요청을 받은 인플루언서만 볼 수 있다.
  if (viewer.role === "user") {
    if (matchRow.account_id !== viewer.accountId) {
      throw new AuthError("이 진단 결과를 볼 수 있는 계정이 아니에요.", 403);
    }
  } else {
    const allowed = await client
      .from("request_cards")
      .select("id, influencer_profiles!inner(account_id)")
      .eq("match_result_id", matchResultId)
      .eq("influencer_profiles.account_id", viewer.accountId)
      .maybeSingle();
    if (allowed.error || !allowed.data) {
      throw new AuthError("이 진단 결과를 볼 수 있는 계정이 아니에요.", 403);
    }
  }

  const sessionId = matchRow.diagnosis_session_id as string;

  const session = await client
    .from("diagnosis_sessions")
    .select("coaching_type")
    .eq("id", sessionId)
    .maybeSingle();
  const coachingType = (session.data as { coaching_type: "personal" | "group" } | null)
    ?.coaching_type;
  if (!coachingType) throw new Error("진단 결과를 불러오지 못했어요.");

  const tpo = await client
    .from("selected_tpos")
    .select("diagnosis_options!inner(code)")
    .eq("diagnosis_session_id", sessionId)
    .eq("scope", "session")
    .maybeSingle();
  const tpoCode = code((tpo.data as Record<string, unknown> | null)?.diagnosis_options);

  const dna = await client
    .from("style_dna_results")
    .select(
      "id, summary_text, matching_points, group_combination_score, group_combination_title, group_combination_description",
    )
    .eq("id", matchRow.style_dna_result_id as string)
    .maybeSingle();
  const dnaRow = (dna.data ?? {}) as Record<string, any>;

  const group = await client
    .from("group_infos")
    .select("relationship_text, diagnosis_options!group_infos_relationship_option_id_fkey(code)")
    .eq("diagnosis_session_id", sessionId)
    .maybeSingle();
  const groupRow = group.data as Record<string, any> | null;

  const members = await client
    .from("session_members")
    .select("id, member_label, persona_code")
    .eq("diagnosis_session_id", sessionId)
    .order("member_order");

  const memberViews: DiagnosisMemberView[] = [];
  for (const member of ((members.data ?? []) as Array<Record<string, any>>)) {
    const input = await client
      .from("member_style_inputs")
      .select(
        `id, height_cm, fit_note,
         body_type:diagnosis_options!member_style_inputs_body_type_option_id_fkey(code),
         preferred:diagnosis_options!member_style_inputs_preferred_style_option_id_fkey(code),
         avoided:diagnosis_options!member_style_inputs_avoid_style_option_id_fkey(code),
         budget_min:diagnosis_options!member_style_inputs_budget_min_option_id_fkey(code),
         budget_max:diagnosis_options!member_style_inputs_budget_max_option_id_fkey(code),
         strategy:diagnosis_options!member_style_inputs_budget_strategy_option_id_fkey(code)`,
      )
      .eq("session_member_id", member.id)
      .maybeSingle();
    const inputRow = input.data as Record<string, any> | null;
    if (!inputRow) continue;

    const selections = await client
      .from("member_style_input_options")
      .select("selection_type, sort_order, diagnosis_options!inner(code)")
      .eq("member_style_input_id", inputRow.id)
      .order("sort_order");
    const byType = new Map<string, string[]>();
    for (const item of ((selections.data ?? []) as Array<Record<string, any>>)) {
      const list = byType.get(item.selection_type) ?? [];
      list.push(code(item.diagnosis_options));
      byType.set(item.selection_type, list);
    }

    const scores = await client
      .from("style_scores")
      .select("score, rank, diagnosis_options!inner(code)")
      .eq("style_dna_result_id", dnaRow.id)
      .eq(
        coachingType === "group" ? "session_member_id" : "style_dna_result_id",
        coachingType === "group" ? member.id : dnaRow.id,
      )
      .order("rank");

    memberViews.push({
      memberLabel: member.member_label,
      personaCode: member.persona_code,
      heightCm: inputRow.height_cm,
      bodyType: code(inputRow.body_type),
      preferredStyle: code(inputRow.preferred),
      avoidedStyle: code(inputRow.avoided),
      budgetLabel: budgetRangeLabel(
        Number(code(inputRow.budget_min)),
        Number(code(inputRow.budget_max)),
      ),
      budgetApproach: code(inputRow.strategy),
      fitConcerns: byType.get("fit_concern") ?? [],
      keywords: byType.get("keyword") ?? [],
      designElements: byType.get("design_element") ?? [],
      preferredItems: byType.get("preferred_item") ?? [],
      avoidedElements: byType.get("avoid_element") ?? [],
      fitNote: inputRow.fit_note,
      styleScores: ((scores.data ?? []) as Array<Record<string, any>>).map((item) => ({
        style: code(item.diagnosis_options),
        score: item.score,
        rank: item.rank,
      })),
    });
  }

  // 부탁해요 카드 원문. 인플루언서 화면이 브라우저 로컬 값을 읽으면
  // 다른 기기에서는 빈 화면이 된다. 저장된 원문을 함께 내려준다.
  const requestCardRow = await client
    .from("request_cards")
    .select("message_text, owned_items_text, avoid_text, sent_at")
    .eq("match_result_id", matchResultId)
    .maybeSingle();
  if (requestCardRow.error) {
    console.error("[BiasFit 조회] request_cards 조회 실패", requestCardRow.error);
  }
  const cardRow = requestCardRow.data as Record<string, any> | null;
  const requestCard: RequestCardView | null = cardRow
    ? {
        messageText: cardRow.message_text ?? "",
        ownedItemsText: cardRow.owned_items_text ?? null,
        avoidText: cardRow.avoid_text ?? null,
        sentAt: cardRow.sent_at ?? null,
      }
    : null;

  let selectedInfluencerName: string | null = null;
  if (matchRow.selected_influencer_profile_id) {
    const selected = await client
      .from("influencer_profiles")
      .select("display_name")
      .eq("id", matchRow.selected_influencer_profile_id)
      .maybeSingle();
    selectedInfluencerName =
      (selected.data as { display_name: string } | null)?.display_name ?? null;
  }

  return {
    matchResultId,
    coachingType,
    priority: matchRow.scoring_profile_code as string,
    tpoCode,
    tpoLabel: tpoLabel(tpoCode),
    styleDnaSummary: dnaRow.summary_text ?? "",
    matchingPoints: Array.isArray(dnaRow.matching_points) ? dnaRow.matching_points : [],
    groupCombination:
      coachingType === "group"
        ? {
            score: dnaRow.group_combination_score ?? null,
            title: dnaRow.group_combination_title ?? null,
            description: dnaRow.group_combination_description ?? null,
          }
        : null,
    relationship: groupRow ? code(groupRow.diagnosis_options) : null,
    members: memberViews,
    selectedInfluencerName,
    requestCard,
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = await requireAccount(request);
    const body = readJsonBody(request) as { matchResultId?: unknown };
    if (typeof body?.matchResultId !== "string" || !body.matchResultId) {
      throw new Error("진단 결과 id가 필요합니다.");
    }
    response
      .status(200)
      .json(await loadDiagnosisResult(body.matchResultId, account));
  } catch (error) {
    console.error("[BiasFit 조회] results/get failed", error);
    sendAuthAwareError(response, error);
  }
}
