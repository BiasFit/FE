import {
  PRIORITY_QUESTION,
  isPriorityOptionsResponse,
  priorityOptionsSchema,
  type PriorityOptionsRequest,
  type PriorityOptionsResponse,
} from "../../../src/domain/aiContracts";
import { tpoLabel } from "../../../src/data/options";
import { GROUNDING_RULES, assertGrounded } from "../../_lib/grounding";
import { SAFE_LANGUAGE_RULES, assertSafeLanguage } from "../../_lib/safe-language";
import {
  callOpenAiStructured,
  generateWithRepair,
  type StructuredOpenAiCaller,
} from "../../_lib/openai";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http";

const LABEL_MIN_LENGTH = 10;
// 그룹 선택지는 A와 B의 조건을 함께 담아야 해서 개인보다 길어진다.
const LABEL_MAX_LENGTH = 45;

/** 이번 요청에서 근거로 삼을 수 있는 입력 폼. */
function requestForms(input: PriorityOptionsRequest) {
  return input.mode === "personal"
    ? [input.personal]
    : [input.group.members.A, input.group.members.B];
}

/** 사용자가 실제로 고른 값만 모아 모델에 내려 준다. */
function selectedVocabulary(input: PriorityOptionsRequest) {
  return requestForms(input).map((form) => ({
    preferredStyle: form.preferredStyle,
    keywords: form.keywords,
    designElements: form.designElements,
    preferredItems: form.preferredItems,
    fitConcerns: form.fitConcerns,
    budgetApproach: form.budgetApproach,
    tpo: tpoLabel(form.tpo),
  }));
}

/** 모델에게는 TPO 내부 코드 대신 사람이 읽는 라벨을 보낸다. */
function withTpoLabels(input: PriorityOptionsRequest) {
  return {
    ...input,
    personal: { ...input.personal, tpo: tpoLabel(input.personal.tpo) },
    group: {
      ...input.group,
      tpo: tpoLabel(input.group.tpo),
      members: {
        A: { ...input.group.members.A, tpo: tpoLabel(input.group.members.A.tpo) },
        B: { ...input.group.members.B, tpo: tpoLabel(input.group.members.B.tpo) },
      },
    },
  };
}

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

function validateResult(
  input: PriorityOptionsRequest,
  allowedRefs: Set<string>,
  result: unknown,
): PriorityOptionsResponse {
  if (!isPriorityOptionsResponse(result)) {
    throw new Error("OpenAI 우선순위 선택지 응답이 허용된 형식과 다릅니다.");
  }
  const normalizedResult = normalizePriorityOptions(input, result);
  // 항목 이름만 적은 짧은 label은 사용자의 입력을 반영한 문장이 아니므로 거절한다.
  const shortLabels = normalizedResult.options
    .filter(
      (option) =>
        option.label.trim().length < LABEL_MIN_LENGTH ||
        option.label.trim().length > LABEL_MAX_LENGTH,
    )
    .map((option) => option.label);
  if (shortLabels.length > 0) {
    throw new Error(
      `선택지 문구는 ${LABEL_MIN_LENGTH}~${LABEL_MAX_LENGTH}자의 한 문장이어야 합니다: ${shortLabels.join(", ")}`,
    );
  }
  const labels = normalizedResult.options.map((option) => option.label);
  assertSafeLanguage(labels);
  assertGrounded(labels, requestForms(input));
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

export async function createPriorityOptions(
  input: PriorityOptionsRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<PriorityOptionsResponse> {
  if (input.mode !== "personal" && input.mode !== "group") {
    throw new Error("코칭 유형이 올바르지 않습니다.");
  }
  const allowedRefs = allowedEvidenceRefs(input);
  return generateWithRepair(
    generate,
    {
      schemaName: "biasfit_priority_options",
      schema: priorityOptionsSchema,
      systemPrompt: [
        "BiasFit 진단의 매칭 우선순위 선택지 문구를 작성한다.",
        `질문은 반드시 '${PRIORITY_QUESTION}'을 그대로 사용한다.`,
        "style_first, fit_first, budget_first, tpo_first를 각각 한 번만 반환한다.",
        `label은 사용자가 1인칭으로 말하듯 쓴 ${LABEL_MIN_LENGTH}~${LABEL_MAX_LENGTH}자의 한 문장이다.`,
        "'스타일', '핏', '예산', 'TPO'처럼 항목 이름만 적으면 안 된다. 사용자가 실제로 고른 값이 문장에 드러나야 한다.",
        "예시 - style_first: '좋아하는 빈티지한 분위기를 가장 먼저 지키고 싶어요' / fit_first: '이동할 때 편안한 착용감과 전체 기장 균형이 중요해요' / budget_first: '정한 예산 안에서 활용도 높은 구성이 중요해요' / tpo_first: '발표·면접에 어울리는 단정하고 신뢰감 있는 인상이 중요해요'",
        "사용자 입력의 취향·핏 고민·예산·TPO만 사용하고 새로운 사실을 추정하지 않는다.",
        "사용자가 고르지 않은 색상·소재·아이템을 문장에 넣지 않는다.",
        GROUNDING_RULES,
        SAFE_LANGUAGE_RULES,
        "각 선택지의 evidenceRefs는 allowedEvidenceRefs 배열에 있는 문자열을 한 개 이상 그대로 사용한다. 다른 경로·라벨·추론값은 금지한다.",
        // 모드별 규칙을 섞어 주면 개인 요청에도 A/B·group 경로를 만들어 내므로 해당 모드의 규칙만 넣는다.
        ...(input.mode === "group"
          ? [
              "A와 B 두 사람의 기준을 모두 보존한다. style_first·fit_first·budget_first의 evidenceRefs에는 'A.'로 시작하는 값과 'B.'로 시작하는 값을 함께 넣는다.",
              // label에 A/B를 모두 넣으라고 하면 길이 제한과 충돌해 문장이 계속 길어진다. 두 사람 반영은 evidenceRefs로만 요구한다.
              "label에는 'A와 B 모두'처럼 두 사람을 나열하지 않는다. 두 사람에게 공통으로 해당하는 기준을 한 문장으로 짧게 쓴다.",
              "tpo_first는 공통 TPO이므로 'group.tpo'를 사용한다.",
              "응답을 반환하기 전에 네 선택지의 evidenceRefs를 모두 합쳐 'A.'로 시작하는 값과 'B.'로 시작하는 값이 각각 최소 하나씩 있는지 확인한다. 없으면 다시 채운다.",
            ]
          : [
              "개인 요청이므로 모든 evidenceRefs는 'personal.'로 시작한다. 'A.', 'B.', 'group.'으로 시작하는 값은 사용하지 않는다.",
            ]),
      ].join(" "),
      input: {
        ...withTpoLabels(input),
        allowedEvidenceRefs: [...allowedRefs],
        selectedVocabulary: selectedVocabulary(input),
      },
    },
    (result) => validateResult(input, allowedRefs, result),
    { label: "AI1" },
  );
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const result = await createPriorityOptions(
      readJsonBody(request) as PriorityOptionsRequest,
    );
    response.status(200).json(result);
  } catch (error) {
    console.error("[BiasFit AI1] priority-options failed", error);
    sendApiError(response, error);
  }
}
