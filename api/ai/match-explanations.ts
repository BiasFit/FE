import {
  matchExplanationsSchema,
  validateMatchExplanations,
  type MatchExplanationsRequest,
  type MatchExplanationsResponse,
} from "../../src/domain/aiContracts";
import {
  callOpenAiStructured,
  type StructuredOpenAiCaller,
} from "../_lib/openai";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

export async function createMatchExplanations(
  input: MatchExplanationsRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<MatchExplanationsResponse> {
  const result = await generate({
    schemaName: "biasfit_match_explanations",
    schema: matchExplanationsSchema,
    systemPrompt: [
      "BiasFit 규칙 엔진이 확정한 TOP 3 추천 근거만 설명한다.",
      "후보, 순위, 점수, 항목별 계산값을 추가하거나 변경하지 않는다.",
      "각 후보의 가장 강한 항목과 실제 matchedEvidence를 설명한다.",
      "그룹은 A와 B의 근거를 각각 최소 하나 포함한다.",
      "외모·몸매 평가나 정답·실패·부적합 같은 판정 표현을 사용하지 않는다.",
    ].join(" "),
    input,
  });
  return validateMatchExplanations(result, input);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const input = readJsonBody(request) as MatchExplanationsRequest;
    let result: MatchExplanationsResponse;
    try {
      result = await createMatchExplanations(input);
    } catch (firstError) {
      console.log("[BiasFit AI4] retrying match explanations", firstError);
      result = await createMatchExplanations(input);
    }
    response.status(200).json(result);
  } catch (error) {
    console.error("[BiasFit AI4] match-explanations failed", error);
    sendApiError(response, error);
  }
}
