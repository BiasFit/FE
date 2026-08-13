import { describe, expect, it, vi } from "vitest";
import type { TestResultPayload } from "../../../src/domain/resultSnapshot";
import { saveDiagnosis, validateTestResultPayload } from "./save";

const personalForm = {
  personaId: "P1",
  height: 158,
  topSize: "S",
  bottomSize: "26",
  bodyType: "웨이브",
  fitConcerns: ["전체 기장·비율"],
  fitNote: "",
  preferredStyle: "로맨틱",
  avoidedStyle: "스트릿",
  keywords: ["부드러운"],
  designElements: ["레이스"],
  preferredItems: ["쉬폰 블라우스"],
  avoidedElements: ["정장처럼 딱딱한 룩"],
  budgetCode: 2,
  budgetMinCode: 2,
  budgetMaxCode: 3,
  budgetApproach: "총액 절약형",
  tpo: "new_semester",
} as TestResultPayload["input"]["members"][number]["form"];

const zeroBreakdowns = Object.fromEntries(
  ["캐주얼", "로맨틱", "스트릿", "빈티지", "오피스 & 비즈니스캐주얼"].map((style) => [
    style,
    [
      { criterionCode: "preferred_keyword" as const, criterionLabel: "선호 키워드 일치", score: 25, maxScore: 25 },
      { criterionCode: "design_element" as const, criterionLabel: "디자인 요소 일치", score: 0, maxScore: 25 },
      { criterionCode: "preferred_item" as const, criterionLabel: "선호 아이템 일치", score: 0, maxScore: 25 },
      { criterionCode: "avoid_adjustment" as const, criterionLabel: "비선호·충돌 요소 보정", score: 15, maxScore: 15 },
      { criterionCode: "preferred_style_bonus" as const, criterionLabel: "선호 스타일 보너스", score: 0, maxScore: 10 },
    ],
  ]),
);

const payload: TestResultPayload = {
  mode: "personal",
  priority: "fit_first",
  tpo: "new_semester",
  anonUserKey: "5f9d2b10-0000-4000-8000-000000000001",
  input: { members: [{ memberId: "self", form: personalForm }] },
  ai: {
    priorityOptions: [
      { code: "fit_first", label: "편안한 핏을 먼저 맞추고 싶어요", evidenceRefs: ["fitConcerns"] },
    ],
    styleDna: {
      mode: "personal",
      personalStyleDnaSummary: "부드러운 일상감과 비율을 함께 고려한 스타일",
      personalStyleDnaSummaryEvidenceRefs: ["personal.preferredStyle"],
      personalMatchingPoints: [
        { text: "전체 비율과 하의 기장을 고려해요.", evidenceRefs: ["personal.fitConcerns.0"] },
      ],
    },
    matchExplanations: [
      {
        influencerId: "stylemate-01",
        strongestCategory: "fit",
        summary: "핏 고민을 함께 다룰 수 있어 추천했어요.",
        evidenceRefs: ["personal.fit.concern.0"],
      },
    ],
  },
  score: {
    styleScores: [
      {
        memberId: "self",
        scores: { 캐주얼: 40, 로맨틱: 75, 스트릿: 0, 빈티지: 20, "오피스 & 비즈니스캐주얼": 30 },
        breakdowns: zeroBreakdowns,
      },
    ],
    rankedInfluencers: [
      {
        rank: 1,
        influencerId: "stylemate-01",
        influencerName: "STYLEMATE 01",
        baseBreakdown: { style: 20, fit: 25, budget: 20, tpo: 15 },
        breakdown: { style: 20, fit: 25, budget: 20, tpo: 15, rawTotal: 80, matchScore: 89 },
        fitDetail: {
          bodyFitResponse: 15,
          fitConcernFit: 10,
          bodyTypeMatched: true,
          matchedConcerns: ["전체 기장·비율"],
        },
      },
    ],
  },
};

/** Supabase 쿼리 빌더 흉내. insert/select/eq/in/single/delete 체인만 지원한다. */
function fakeClient(overrides: { failOn?: string } = {}) {
  const inserted: Array<{ table: string; rows: unknown }> = [];
  const deleted: string[] = [];
  let idCounter = 0;

  const client = {
    inserted,
    deleted,
    from(table: string) {
      return {
        insert(rows: unknown) {
          if (overrides.failOn === table) {
            return {
              select: () => ({
                single: async () => ({ data: null, error: { message: "boom", code: "23503" } }),
              }),
              then: (resolve: (value: unknown) => unknown) =>
                resolve({ error: { message: "boom", code: "23503" } }),
            };
          }
          inserted.push({ table, rows });
          idCounter += 1;
          const id = `${table}-${idCounter}`;
          return {
            select: () => ({ single: async () => ({ data: { id }, error: null }) }),
            then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
          };
        },
        select(columns: string) {
          if (table === "diagnosis_options") {
            return {
              eq: async () => ({
                data: optionRows(),
                error: null,
              }),
            };
          }
          if (table === "influencer_profiles") {
            return {
              in: async () => ({
                data: [
                  { id: "profile-1", accounts: { dummy_login_id: "stylemate-01" } },
                ],
                error: null,
              }),
            };
          }
          return { eq: async () => ({ data: null, error: null }), columns };
        },
        delete() {
          return {
            eq: async (_column: string, value: string) => {
              deleted.push(value);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return client as unknown as Parameters<typeof saveDiagnosis>[2] & {
    inserted: typeof inserted;
    deleted: typeof deleted;
  };
}

/** 시드와 같은 (option_group, code) 조합을 흉내낸다. */
function optionRows() {
  const rows: Array<{ id: string; option_group: string; code: string }> = [];
  const add = (group: string, codes: Array<string | number>) => {
    for (const code of codes) {
      rows.push({ id: `${group}:${code}`, option_group: group, code: String(code) });
    }
  };
  add("body_type", ["스트레이트", "웨이브", "내추럴"]);
  add("style_type", ["캐주얼", "로맨틱", "스트릿", "빈티지", "오피스 & 비즈니스캐주얼"]);
  add("fit_concern", ["전체 기장·비율"]);
  add("keyword", ["부드러운"]);
  add("design_element", ["레이스"]);
  add("preferred_item", ["쉬폰 블라우스"]);
  add("avoid_element", ["정장처럼 딱딱한 룩"]);
  add("budget_range", [1, 2, 3, 4, 5, 6, 7]);
  add("budget_strategy", ["총액 절약형"]);
  add("tpo", ["new_semester", "travel"]);
  add("relationship", ["friend"]);
  return rows;
}

function tableRows(client: ReturnType<typeof fakeClient>, table: string) {
  return client.inserted.filter((entry) => entry.table === table);
}

describe("validateTestResultPayload", () => {
  it("TPO 라벨을 코드 대신 넣으면 거절한다", () => {
    expect(() => validateTestResultPayload({ ...payload, tpo: "개강·새학기" })).toThrow(
      "TPO 코드가 올바르지 않습니다.",
    );
  });

  it("모르는 우선순위를 거절한다", () => {
    expect(() => validateTestResultPayload({ ...payload, priority: "vibe_first" })).toThrow(
      "매칭 우선순위가 올바르지 않습니다.",
    );
  });

  it("그룹인데 구성원이 1명이면 거절한다", () => {
    expect(() => validateTestResultPayload({ ...payload, mode: "group" })).toThrow(
      "진단 입력값의 구성원 수가 올바르지 않습니다.",
    );
  });
});

describe("saveDiagnosis", () => {
  it("토큰에서 받은 accountId로 진단 세션을 만든다", async () => {
    const client = fakeClient();

    const saved = await saveDiagnosis("account-1", payload, client);

    expect(saved.matchResultId).toBe(saved.id);
    const session = tableRows(client, "diagnosis_sessions")[0].rows as Record<string, unknown>;
    // 프런트가 보낸 값이 아니라 토큰에서 꺼낸 id여야 한다.
    expect(session.account_id).toBe("account-1");
    expect(session.coaching_type).toBe("personal");
    expect(session.matching_priority_code).toBe("fit_first");
    expect(session.status).toBe("completed");
  });

  it("선택값을 라벨이 아니라 diagnosis_options.id로 저장한다", async () => {
    const client = fakeClient();

    await saveDiagnosis("account-1", payload, client);

    const styleInput = tableRows(client, "member_style_inputs")[0].rows as Record<string, unknown>;
    expect(styleInput.body_type_option_id).toBe("body_type:웨이브");
    expect(styleInput.preferred_style_option_id).toBe("style_type:로맨틱");
    expect(styleInput.budget_min_option_id).toBe("budget_range:2");
    expect(styleInput.budget_strategy_option_id).toBe("budget_strategy:총액 절약형");

    const tpo = tableRows(client, "selected_tpos")[0].rows as Array<Record<string, unknown>>;
    expect(tpo[0].tpo_option_id).toBe("tpo:new_semester");
  });

  it("다중 선택값을 selection_type별로 편다", async () => {
    const client = fakeClient();

    await saveDiagnosis("account-1", payload, client);

    const rows = tableRows(client, "member_style_input_options")[0].rows as Array<
      Record<string, unknown>
    >;
    expect(rows.map((row) => row.selection_type)).toEqual([
      "fit_concern",
      "keyword",
      "design_element",
      "preferred_item",
      "avoid_element",
    ]);
  });

  it("스타일 점수를 순위와 함께 저장하고 항목 내역을 남긴다", async () => {
    const client = fakeClient();

    await saveDiagnosis("account-1", payload, client);

    const scores = tableRows(client, "style_scores").map(
      (entry) => entry.rows as Record<string, unknown>,
    );
    expect(scores).toHaveLength(5);
    // 로맨틱 75가 1위여야 한다.
    expect(scores[0].style_option_id).toBe("style_type:로맨틱");
    expect(scores[0].rank).toBe(1);
    expect(scores[0].level).toBe("strong");

    const breakdowns = tableRows(client, "style_score_breakdowns")[0].rows as Array<
      Record<string, unknown>
    >;
    expect(breakdowns).toHaveLength(5);
  });

  it("개인은 체형·핏을 두 기준으로 나눠 저장한다", async () => {
    const client = fakeClient();

    await saveDiagnosis("account-1", payload, client);

    const rows = tableRows(client, "match_score_breakdowns")[0].rows as Array<
      Record<string, unknown>
    >;
    expect(rows.map((row) => row.criterion_code)).toEqual([
      "style_fit",
      "body_fit_response",
      "fit_concern_fit",
      "budget_fit",
      "tpo_fit",
    ]);
    expect(rows[1].score).toBe(15);
    expect(rows[2].score).toBe(10);
  });

  it("화면에 보인 매칭 점수를 그대로 저장한다", async () => {
    const client = fakeClient();

    await saveDiagnosis("account-1", payload, client);

    const recommended = tableRows(client, "match_recommended_influencers")[0].rows as Record<
      string,
      unknown
    >;
    expect(recommended.match_score).toBe(89);
    expect(recommended.rank).toBe(1);
    // 화면용 문자열이 아니라 influencer_profiles.id여야 한다.
    expect(recommended.influencer_profile_id).toBe("profile-1");
    expect(recommended.reason_text).toBe("핏 고민을 함께 다룰 수 있어 추천했어요.");
  });

  it("중간에 실패하면 진단 세션을 지워 부분 저장을 남기지 않는다", async () => {
    const client = fakeClient({ failOn: "style_dna_results" });

    await expect(saveDiagnosis("account-1", payload, client)).rejects.toThrow(
      "Style DNA 결과을(를) 저장하지 못했어요.",
    );
    expect(client.deleted).toEqual(["diagnosis_sessions-1"]);
  });

  it("저장 과정에서 OpenAI를 부르지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await saveDiagnosis("account-1", payload, fakeClient());

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
