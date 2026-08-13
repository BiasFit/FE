import { tpoLabel } from "../../../src/data/options.js";
import { requireAccount, sendAuthAwareError } from "../../_lib/auth.js";
import { supabaseAdmin } from "../../_lib/supabase.js";
import {
  readJsonBody,
  requirePost,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 마이페이지 한 화면에 필요한 기록을 한 번에 돌려준다 (DB_SCHEMA.md 2.1, SCREEN_SPEC.md 3.9).
 *
 * **저장된 스냅샷만 읽는다. 점수·순위·문구를 다시 계산하지 않는다.**
 * 마이페이지는 "그때 받은 그대로"를 보여주는 화면이다. 다시 계산하면 과거 기록이 바뀐다.
 *
 * 본인 것만 본다. 계정은 토큰에서 꺼내고 프런트가 보낸 값은 쓰지 않는다.
 *
 * 요청을 하나로 묶은 이유 — 화면이 요약·코디 카드·진단 기록을 함께 그리고,
 * TPO 필터도 세 목록에 같이 걸린다. 나눠 두면 화면이 네 번 부르고 필터마다 또 부른다.
 */
type Client = ReturnType<typeof supabaseAdmin>;

export interface MypageDiagnosis {
  styleDnaResultId: string;
  matchResultId: string | null;
  diagnosedAt: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  styleDnaSummary: string;
  styleTags: string[];
  /** 아직 아무도 안 골랐으면 null. 화면은 `매칭 전`으로 쓴다. */
  selectedInfluencerName: string | null;
}

export interface MypageOutfit {
  outfitCardId: string;
  matchResultId: string;
  title: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  influencerName: string;
  deliveredAt: string | null;
}

export interface MypagePending {
  matchResultId: string;
  coachingType: "personal" | "group";
  tpoCode: string;
  tpoLabel: string;
  influencerName: string | null;
  requestSentAt: string | null;
  /** 「요청 내용 보기」에 쓴다. 읽기 전용이고 답장·재요청은 없다. */
  requestMessage: string;
}

export interface MypageOverview {
  loginId: string;
  displayName: string;
  summary: {
    /** 전달 완료된 코디 카드 수. 그룹의 A·B 카드도 매칭 1건으로 센다. */
    outfitCardCount: number;
    diagnosisCount: number;
    lastActivityAt: string | null;
  };
  /** 세 목록에는 TPO 필터가 걸린다. 위 요약은 전체 기준이다. */
  diagnoses: MypageDiagnosis[];
  outfits: MypageOutfit[];
  pending: MypagePending[];
}

/** PostgREST는 관계가 1:1이면 배열이 아니라 객체 하나를 준다. 둘 다 받는다. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function many<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function code(value: unknown) {
  return one<{ code: string }>(value as any)?.code ?? "";
}

/** 세션에 저장된 TPO 코드. 개인·그룹 모두 `scope = 'session'` 한 행이다. */
function sessionTpo(session: Record<string, any> | null) {
  const rows = many<Record<string, any>>(session?.selected_tpos);
  const chosen = rows.find((row) => row.scope === "session") ?? rows[0];
  return code(chosen?.diagnosis_options);
}

function newestOf(...values: Array<string | null | undefined>) {
  const times = values.filter((value): value is string => Boolean(value));
  if (times.length === 0) return null;
  return times.reduce((latest, value) => (value > latest ? value : latest));
}

export async function loadMypageOverview(
  account: { accountId: string; loginId: string; displayName: string },
  tpoCode: string | null,
  client: Client = supabaseAdmin(),
): Promise<MypageOverview> {
  // 1) 진단 기록 — 완료된 세션의 Style DNA 결과. 최신순.
  const dna = await client
    .from("style_dna_results")
    .select(
      `id, created_at, summary_text,
       diagnosis_sessions!inner (
         account_id, coaching_type, status,
         selected_tpos ( scope, diagnosis_options ( code ) )
       ),
       member_style_dna_summaries ( style_tags ),
       match_results (
         id,
         influencer_profiles ( display_name )
       )`,
    )
    .eq("diagnosis_sessions.account_id", account.accountId)
    .eq("diagnosis_sessions.status", "completed")
    .order("created_at", { ascending: false });

  if (dna.error) {
    console.error("[BiasFit 마이페이지] 진단 기록 조회 실패", dna.error);
    throw new Error("기록을 불러오지 못했어요.");
  }

  const allDiagnoses: MypageDiagnosis[] = ((dna.data ?? []) as Array<Record<string, any>>).map(
    (row) => {
      const session = one<Record<string, any>>(row.diagnosis_sessions);
      const match = one<Record<string, any>>(row.match_results);
      const tpo = sessionTpo(session);
      const tags = many<Record<string, any>>(row.member_style_dna_summaries)[0]?.style_tags;
      return {
        styleDnaResultId: row.id,
        matchResultId: match?.id ?? null,
        diagnosedAt: row.created_at,
        coachingType: session?.coaching_type ?? "personal",
        tpoCode: tpo,
        tpoLabel: tpoLabel(tpo),
        styleDnaSummary: row.summary_text ?? "",
        styleTags: Array.isArray(tags) ? tags : [],
        selectedInfluencerName:
          one<{ display_name: string }>(match?.influencer_profiles)?.display_name ?? null,
      };
    },
  );

  // 2) 코디 카드 도착 — 전달 완료만. 최신순.
  const cards = await client
    .from("outfit_cards")
    .select(
      `id, match_result_id, title, coaching_type, delivered_at,
       influencer_profiles!inner ( display_name ),
       tpo:diagnosis_options!outfit_cards_representative_tpo_option_id_fkey ( code )`,
    )
    .eq("user_account_id", account.accountId)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });

  if (cards.error) {
    console.error("[BiasFit 마이페이지] 코디 카드 조회 실패", cards.error);
    throw new Error("기록을 불러오지 못했어요.");
  }

  const allOutfits: MypageOutfit[] = ((cards.data ?? []) as Array<Record<string, any>>).map(
    (row) => {
      const tpo = code(row.tpo);
      return {
        outfitCardId: row.id,
        matchResultId: row.match_result_id,
        title: row.title ?? "",
        coachingType: row.coaching_type,
        tpoCode: tpo,
        tpoLabel: tpoLabel(tpo),
        influencerName:
          one<{ display_name: string }>(row.influencer_profiles)?.display_name ?? "",
        deliveredAt: row.delivered_at ?? null,
      };
    },
  );

  // 3) 코디 카드 준비 중 — 요청은 보냈는데 아직 전달된 카드가 없는 매칭.
  const waiting = await client
    .from("match_results")
    .select(
      `id, status,
       influencer_profiles ( display_name ),
       diagnosis_sessions!inner (
         coaching_type,
         selected_tpos ( scope, diagnosis_options ( code ) )
       ),
       request_cards ( message_text, sent_at, status ),
       outfit_cards ( status )`,
    )
    .eq("account_id", account.accountId)
    .in("status", ["request_sent", "outfit_pending"])
    .order("updated_at", { ascending: false });

  if (waiting.error) {
    console.error("[BiasFit 마이페이지] 준비 중 매칭 조회 실패", waiting.error);
    throw new Error("기록을 불러오지 못했어요.");
  }

  const allPending: MypagePending[] = ((waiting.data ?? []) as Array<Record<string, any>>)
    // 카드가 이미 전달됐으면 준비 중이 아니다.
    .filter((row) => !many<{ status: string }>(row.outfit_cards).some((c) => c.status === "delivered"))
    .map((row) => {
      const session = one<Record<string, any>>(row.diagnosis_sessions);
      const request = one<Record<string, any>>(row.request_cards);
      const tpo = sessionTpo(session);
      return {
        matchResultId: row.id,
        coachingType: session?.coaching_type ?? "personal",
        tpoCode: tpo,
        tpoLabel: tpoLabel(tpo),
        influencerName:
          one<{ display_name: string }>(row.influencer_profiles)?.display_name ?? null,
        requestSentAt: request?.sent_at ?? null,
        requestMessage: request?.message_text ?? "",
      };
    });

  const byTpo = <T extends { tpoCode: string }>(rows: T[]) =>
    tpoCode ? rows.filter((row) => row.tpoCode === tpoCode) : rows;

  return {
    loginId: account.loginId,
    displayName: account.displayName,
    summary: {
      // 요약은 필터와 무관한 전체 수치다 (DB_SCHEMA.md 2.1).
      outfitCardCount: allOutfits.length,
      diagnosisCount: allDiagnoses.length,
      lastActivityAt: newestOf(
        allDiagnoses[0]?.diagnosedAt,
        allOutfits[0]?.deliveredAt,
        ...allPending.map((row) => row.requestSentAt),
      ),
    },
    diagnoses: byTpo(allDiagnoses),
    outfits: byTpo(allOutfits),
    pending: byTpo(allPending),
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = await requireAccount(request);
    const body = readJsonBody(request) as { tpoCode?: unknown };
    const tpoCode = typeof body?.tpoCode === "string" && body.tpoCode ? body.tpoCode : null;
    response
      .status(200)
      .json(await loadMypageOverview(account, tpoCode));
  } catch (error) {
    console.error("[BiasFit 마이페이지] mypage/overview failed", error);
    sendAuthAwareError(response, error);
  }
}
