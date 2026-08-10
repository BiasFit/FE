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

function allowedEvidenceRefs(input: PriorityOptionsRequest) {
  const fields = [
    "preferredStyle",
    "avoidedStyle",
    "keywords",
    "designElements",
    "preferredItems",
    "fitConcerns",
    "fitNote",
    "budgetCode",
    "budgetMinCode",
    "budgetMaxCode",
    "budgetRange",
    "budgetApproach",
    "tpo",
  ];
  if (input.mode === "personal") {
    return new Set(fields.map((field) => `personal.${field}`));
  }
  return new Set([
    ...fields.map((field) => `A.${field}`),
    ...fields.map((field) => `B.${field}`),
    "group.tpo",
  ]);
}

function normalizeEvidenceRef(
  input: PriorityOptionsRequest,
  evidenceRef: string,
) {
  if (input.mode === "personal" && !evidenceRef.startsWith("personal.")) {
    return `personal.${evidenceRef}`;
  }
  return evidenceRef;
}

function normalizePriorityOptions(
  input: PriorityOptionsRequest,
  result: PriorityOptionsResponse,
): PriorityOptionsResponse {
  return {
    ...result,
    options: result.options.map((option) => ({
      ...option,
      evidenceRefs: option.evidenceRefs.map((ref) =>
        normalizeEvidenceRef(input, ref),
      ),
    })),
  };
}

export async function createPriorityOptions(
  input: PriorityOptionsRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<PriorityOptionsResponse> {
  if (input.mode !== "personal" && input.mode !== "group") {
    throw new Error("코칭 유형이 올바르지 않습니다.");
  }
  const allowedRefs = allowedEvidenceRefs(input);
  const result = await generate({
    schemaName: "biasfit_priority_options",
    schema: priorityOptionsSchema,
    systemPrompt: [
      "BiasFit 진단의 매칭 우선순위 선택지 문구를 작성한다.",
      `질문은 반드시 '${PRIORITY_QUESTION}'을 그대로 사용한다.`,
      "style_first, fit_first, budget_first, tpo_first를 각각 한 번만 반환한다.",
      "사용자 입력의 취향·핏 고민·예산·TPO만 사용하고 새로운 사실을 추정하지 않는다.",
      "그룹이면 A와 B의 기준을 모두 보존한다.",
      "각 선택지의 evidenceRefs는 allowedEvidenceRefs 배열에 있는 문자열을 한 개 이상 그대로 사용한다. 다른 경로·라벨·추론값은 금지한다.",
    ].join(" "),
    input: {
      ...input,
      allowedEvidenceRefs: [...allowedRefs],
    },
  });
  if (!isPriorityOptionsResponse(result)) {
    throw new Error("OpenAI 우선순위 선택지 응답이 허용된 형식과 다릅니다.");
  }
  const normalizedResult = normalizePriorityOptions(input, result);
  const refs = normalizedResult.options.flatMap((option) => option.evidenceRefs);
  const invalidRefs = refs.filter((ref) => !allowedRefs.has(ref));
  if (invalidRefs.length > 0) {
    throw new Error(`OpenAI returned unsupported priority evidence refs: ${invalidRefs.join(", ")}`);
  }
  if (
    input.mode === "group" &&
    (!refs.some((ref) => ref.startsWith("A.")) ||
      !refs.some((ref) => ref.startsWith("B.")))
  ) {
    throw new Error("그룹 우선순위 선택지는 A와 B의 입력을 모두 반영해야 합니다.");
  }
  return normalizedResult;
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
