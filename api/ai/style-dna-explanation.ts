import {
  groupStyleDnaSchema,
  personalStyleDnaSchema,
  validateStyleDnaExplanation,
  type EvidenceText,
  type GroupStyleDnaExplanation,
  type StyleDnaExplanationRequest,
  type StyleDnaExplanationResponse,
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

function evidenceCatalog(input: StyleDnaExplanationRequest) {
  return input.members.flatMap((member) => {
    const prefix = member.memberId;
    return [
      `${prefix}.preferredStyle`,
      `${prefix}.keywords`,
      `${prefix}.designElements`,
      `${prefix}.preferredItems`,
      ...member.form.fitConcerns.map((_, index) => `${prefix}.fitConcerns.${index}`),
      `${prefix}.budgetRange`,
      `${prefix}.budgetApproach`,
      `${prefix}.tpo`,
      ...Object.keys(member.styleScores).map(
        (style) => `${prefix}.styleScores.${style}`,
      ),
    ];
  });
}

export function combinationMetricText(compatibility: {
  styleSimilarity: number;
  budgetCompatibility: number;
}) {
  return `스타일 방향 유사도 ${compatibility.styleSimilarity}/70 · 예산 조율 가능성 ${compatibility.budgetCompatibility}/30.`;
}

function responseEvidence(response: StyleDnaExplanationResponse) {
  if (response.mode === "personal") {
    return response.personalMatchingPoints.flatMap(
      (point: EvidenceText) => point.evidenceRefs,
    ).concat(response.personalStyleDnaSummaryEvidenceRefs);
  }
  return [
    ...response.groupStyleDnaSummaryEvidenceRefs,
    ...response.groupCombination.evidenceRefs,
    ...response.groupMatchingPoints.flatMap((point) => point.evidenceRefs),
  ];
}

export async function createStyleDnaExplanation(
  input: StyleDnaExplanationRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<StyleDnaExplanationResponse> {
  const allowedEvidenceRefs = evidenceCatalog(input);
  const result = await generate({
    schemaName: `biasfit_${input.mode}_style_dna`,
    schema:
      input.mode === "personal" ? personalStyleDnaSchema : groupStyleDnaSchema,
    systemPrompt: [
      "BiasFit Style DNA 계산 결과를 사용자가 이해하기 쉬운 한국어로 설명한다.",
      "점수, 예산, 우선순위와 그룹 조합 수치를 절대 변경하지 않는다.",
      "개인 요약은 15~35자, 그룹 요약은 20~45자이며 마침표 없이 '스타일'로 끝낸다.",
      "매칭 중요 포인트는 2~3개를 반환한다.",
      "피하고 싶은 스타일을 설명 근거로 직접 언급하지 않는다.",
      "외모·몸매·등급·교정 표현을 사용하지 않는다.",
      "요약문에도 실제 근거를 summaryEvidenceRefs로 반드시 반환하고, 각 문장은 제공된 allowedEvidenceRefs만 사용한다.",
      "그룹 조합 설명(description)에는 점수 수치를 쓰지 않고, 두 사람이 함께 코디할 때의 조율 방향만 1~2문장으로 쓴다. 수치 문구는 서버가 앞에 붙인다.",
      "낮은 조합도를 실패·부적합으로 표현하지 않고, 같은 스타일로 맞춰 입으라고 하지 않는다.",
    ].join(" "),
    input: { ...input, allowedEvidenceRefs },
  });
  const validated = validateStyleDnaExplanation(result);
  if (validated.mode !== input.mode) {
    throw new Error("OpenAI가 진단 모드를 변경했습니다.");
  }
  if (!responseEvidence(validated).every((ref) => allowedEvidenceRefs.includes(ref))) {
    throw new Error("OpenAI가 입력에 없는 근거를 사용했습니다.");
  }
  if (validated.mode === "group") {
    const compatibility = input.groupCompatibility;
    if (!compatibility) throw new Error("그룹 조합 계산값이 없습니다.");
    const group = validated as GroupStyleDnaExplanation;
    if (
      group.groupCombination.score !== compatibility.total ||
      group.groupCombination.directionSimilarity !== compatibility.styleSimilarity ||
      group.groupCombination.budgetCoordination !== compatibility.budgetCompatibility
    ) {
      throw new Error("OpenAI가 그룹 조합 계산값을 변경했습니다.");
    }
    const groupSummaryRefs = group.groupStyleDnaSummaryEvidenceRefs;
    if (
      !groupSummaryRefs.some((ref) => ref.startsWith("A.")) ||
      !groupSummaryRefs.some((ref) => ref.startsWith("B.")) ||
      groupSummaryRefs.some((ref) => /\.(fitConcerns|budgetRange|budgetApproach|tpo)/.test(ref))
    ) {
      throw new Error("그룹 Style DNA 요약은 A/B 스타일 신호만 근거로 사용해야 합니다.");
    }
    // 수치는 규칙 엔진 값만 쓰고, 조율 방향 설명은 AI 문장을 유지한다.
    const guidance = group.groupCombination.description.trim();
    if (!guidance || /\d+\s*\/\s*(70|30)|\d+\s*점/.test(guidance)) {
      throw new Error("그룹 조합 설명은 수치 없이 조율 방향만 작성해야 합니다.");
    }
    group.groupCombination.description = `${combinationMetricText(compatibility)} ${guidance}`;
  }
  return validated;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const input = readJsonBody(request) as StyleDnaExplanationRequest;
    let result: StyleDnaExplanationResponse;
    try {
      result = await createStyleDnaExplanation(input);
    } catch (firstError) {
      console.log("[BiasFit AI2] retrying Style DNA explanation", firstError);
      result = await createStyleDnaExplanation(input);
    }
    response.status(200).json(result);
  } catch (error) {
    console.error("[BiasFit AI2] style-dna-explanation failed", error);
    sendApiError(response, error);
  }
}
