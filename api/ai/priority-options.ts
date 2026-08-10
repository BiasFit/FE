import {
  PRIORITY_QUESTION,
  isPriorityOptionsResponse,
  priorityOptionsSchema,
  type PriorityOptionsRequest,
  type PriorityOptionsResponse,
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

export async function createPriorityOptions(
  input: PriorityOptionsRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<PriorityOptionsResponse> {
  if (input.mode !== "personal" && input.mode !== "group") {
    throw new Error("코칭 유형이 올바르지 않습니다.");
  }
  const result = await generate({
    schemaName: "biasfit_priority_options",
    schema: priorityOptionsSchema,
    systemPrompt: [
      "BiasFit 진단의 매칭 우선순위 선택지 문구를 작성한다.",
      `질문은 반드시 '${PRIORITY_QUESTION}'을 그대로 사용한다.`,
      "style_first, fit_first, budget_first, tpo_first를 각각 한 번만 반환한다.",
      "사용자가 입력한 취향·핏·예산·TPO만 사용하고 새로운 사실을 추정하지 않는다.",
      "그룹이면 A와 B의 기준을 모두 보존한다.",
      "각 선택지에 사용한 입력 필드명을 evidenceRefs로 반환한다.",
    ].join(" "),
    input,
  });
  if (!isPriorityOptionsResponse(result)) {
    throw new Error("OpenAI 우선순위 선택지 응답이 허용된 형식과 다릅니다.");
  }
  return result;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const result = await createPriorityOptions(
      readJsonBody(request) as PriorityOptionsRequest,
    );
    response.status(200).json(result);
  } catch (error) {
    sendApiError(response, error);
  }
}
