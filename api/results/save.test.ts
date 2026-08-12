import { describe, expect, it, vi } from "vitest";
import type { TestResultPayload } from "../../src/domain/resultSnapshot";
import { saveTestResult, toTestResultRow, type TestResultRow } from "./save";

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
  designElements: ["플리츠"],
  preferredItems: ["블라우스"],
  avoidedElements: ["오버사이즈"],
  budgetCode: 2,
  budgetMinCode: 1,
  budgetMaxCode: 3,
  budgetApproach: "총액 절약형",
  tpo: "new_semester",
} as TestResultPayload["input"]["members"][number]["form"];

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
        breakdowns: {
          로맨틱: [
            { criterionCode: "preferred_keyword", criterionLabel: "선호 키워드 일치", score: 25, maxScore: 25 },
            { criterionCode: "design_element", criterionLabel: "디자인 요소 일치", score: 25, maxScore: 25 },
            { criterionCode: "preferred_item", criterionLabel: "선호 아이템 일치", score: 0, maxScore: 25 },
            { criterionCode: "avoid_adjustment", criterionLabel: "비선호·충돌 요소 보정", score: 15, maxScore: 15 },
            { criterionCode: "preferred_style_bonus", criterionLabel: "선호 스타일 보너스", score: 10, maxScore: 10 },
          ],
        },
      },
    ],
    rankedInfluencers: [
      {
        rank: 1,
        influencerId: "stylemate-01",
        influencerName: "지수",
        baseBreakdown: { style: 20, fit: 28, budget: 14, tpo: 20 },
        breakdown: { style: 20, fit: 28, budget: 14, tpo: 20, rawTotal: 82, matchScore: 91 },
      },
    ],
  },
};

describe("saveTestResult", () => {
  it("passes the screen values through to the insert unchanged", async () => {
    const insert = vi.fn(async () => "8f1c0c7e-0000-4000-8000-000000000000");

    const result = await saveTestResult(payload, insert);

    expect(result).toEqual({ id: "8f1c0c7e-0000-4000-8000-000000000000" });
    expect(insert).toHaveBeenCalledWith({
      mode: "personal",
      priority: "fit_first",
      tpo: "new_semester",
      anon_user_key: "5f9d2b10-0000-4000-8000-000000000001",
      input_json: payload.input,
      ai_result_json: payload.ai,
      score_result_json: payload.score,
    });
  });

  it("rejects a payload without an anonymous user key", async () => {
    const insert = vi.fn(async (_row: TestResultRow) => "unused");

    await expect(
      saveTestResult({ ...payload, anonUserKey: "   " }, insert),
    ).rejects.toThrow("익명 사용자 키가 없습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps the tpo internal code out of jsonb so records stay filterable", () => {
    const row = toTestResultRow(payload);

    expect(row.tpo).toBe("new_semester");
    expect(row.mode).toBe("personal");
    expect(row.priority).toBe("fit_first");
  });

  it("stores both members for a group diagnosis", async () => {
    const insert = vi.fn(async (_row: TestResultRow) => "group-id");
    const groupPayload: TestResultPayload = {
      ...payload,
      mode: "group",
      tpo: "travel",
      input: {
        members: [
          { memberId: "A", form: { ...personalForm, tpo: "travel" } },
          { memberId: "B", form: { ...personalForm, tpo: "travel" } },
        ],
        group: { relationship: "friend", relationshipOther: "" },
      },
      score: {
        ...payload.score,
        groupCompatibility: { styleSimilarity: 45, budgetCompatibility: 20, total: 65 },
      },
    };

    await saveTestResult(groupPayload, insert);

    expect(insert.mock.calls[0][0].input_json.members).toHaveLength(2);
    expect(insert.mock.calls[0][0].score_result_json.groupCompatibility).toEqual({
      styleSimilarity: 45,
      budgetCompatibility: 20,
      total: 65,
    });
  });

  it("rejects a tpo label instead of an internal code", async () => {
    const insert = vi.fn(async () => "unused");

    await expect(
      saveTestResult({ ...payload, tpo: "개강·새학기" }, insert),
    ).rejects.toThrow("TPO 코드가 올바르지 않습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown match priority", async () => {
    const insert = vi.fn(async () => "unused");

    await expect(
      saveTestResult({ ...payload, priority: "vibe_first" }, insert),
    ).rejects.toThrow("매칭 우선순위가 올바르지 않습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown diagnosis mode", async () => {
    const insert = vi.fn(async () => "unused");

    await expect(
      saveTestResult({ ...payload, mode: "solo" }, insert),
    ).rejects.toThrow("진단 유형이 올바르지 않습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a group diagnosis that carries only one member", async () => {
    const insert = vi.fn(async () => "unused");

    await expect(
      saveTestResult({ ...payload, mode: "group" }, insert),
    ).rejects.toThrow("진단 입력값의 구성원 수가 올바르지 않습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a payload whose AI result is missing", async () => {
    const insert = vi.fn(async () => "unused");

    await expect(
      saveTestResult({ ...payload, ai: { priorityOptions: [], matchExplanations: [] } }, insert),
    ).rejects.toThrow("저장할 AI 결과가 없습니다.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not call OpenAI while saving", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await saveTestResult(payload, async () => "id");

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
