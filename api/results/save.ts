import { isTpoCode } from "../../src/data/options";
import { isMatchPriority } from "../../src/domain/aiContracts";
import type { TestResultPayload } from "../../src/domain/resultSnapshot";
import { supabaseAdmin } from "../_lib/supabase";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/** test_results 테이블의 컬럼 이름 그대로. mode·priority·tpo는 나중에 필터·집계하려고 jsonb 밖에 둔다. */
export interface TestResultRow {
  mode: TestResultPayload["mode"];
  priority: TestResultPayload["priority"];
  tpo: TestResultPayload["tpo"];
  anon_user_key: TestResultPayload["anonUserKey"];
  input_json: TestResultPayload["input"];
  ai_result_json: TestResultPayload["ai"];
  score_result_json: TestResultPayload["score"];
}

/** 한 행을 넣고 생성된 id를 돌려준다. 테스트에서 갈아끼울 수 있게 함수로 분리했다. */
export type TestResultInserter = (row: TestResultRow) => Promise<string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 저장 직전 마지막 방어선이다. 어휘가 어긋난 값이 DB에 들어가면 매칭이 조용히 깨진다.
 * 검사 함수는 화면과 같은 것을 쓴다. 여기서 새로 만들면 두 벌이 되어 또 어긋난다.
 */
export function validateTestResultPayload(value: unknown): TestResultPayload {
  if (!isRecord(value)) {
    throw new Error("저장할 진단 결과가 없습니다.");
  }
  if (value.mode !== "personal" && value.mode !== "group") {
    throw new Error("진단 유형이 올바르지 않습니다.");
  }
  if (!isMatchPriority(value.priority)) {
    throw new Error("매칭 우선순위가 올바르지 않습니다.");
  }
  if (!isTpoCode(value.tpo)) {
    throw new Error("TPO 코드가 올바르지 않습니다.");
  }
  // anon_user_key는 not null이다. 빈 문자열을 보내면 DB가 아니라 여기서 걸러야 원인이 드러난다.
  if (typeof value.anonUserKey !== "string" || value.anonUserKey.trim() === "") {
    throw new Error("익명 사용자 키가 없습니다.");
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

export function toTestResultRow(payload: TestResultPayload): TestResultRow {
  return {
    mode: payload.mode,
    priority: payload.priority,
    tpo: payload.tpo,
    anon_user_key: payload.anonUserKey.trim(),
    input_json: payload.input,
    ai_result_json: payload.ai,
    score_result_json: payload.score,
  };
}

const insertWithSupabase: TestResultInserter = async (row) => {
  const { data, error } = await supabaseAdmin()
    .from("test_results")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    // 원문에는 접속 정보가 섞일 수 있다. 서버 로그로만 남기고 밖으로는 짧은 문구만 보낸다.
    console.error("[BiasFit 저장] test_results insert 실패", error);
    throw new Error("진단 결과를 저장하지 못했습니다.");
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== "string") {
    throw new Error("진단 결과를 저장하지 못했습니다.");
  }
  return id;
};

export async function saveTestResult(
  input: unknown,
  insert: TestResultInserter = insertWithSupabase,
): Promise<{ id: string }> {
  const payload = validateTestResultPayload(input);
  return { id: await insert(toTestResultRow(payload)) };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json(await saveTestResult(readJsonBody(request)));
  } catch (error) {
    console.error("[BiasFit 저장] results/save failed", error);
    sendApiError(response, error);
  }
}
