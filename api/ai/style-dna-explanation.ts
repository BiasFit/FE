import {
  groupStyleDnaSchema,
  personalStyleDnaSchema,
  validateStyleDnaExplanation,
  type EvidenceText,
  type GroupStyleDnaExplanation,
  type StyleDnaExplanationRequest,
  type StyleDnaExplanationResponse,
} from "../../src/domain/aiContracts";
import { tpoLabel } from "../../src/data/options";
import { GROUNDING_RULES, assertGrounded } from "../_lib/grounding";
import { SAFE_LANGUAGE_RULES, assertSafeLanguage } from "../_lib/safe-language";
import {
  callOpenAiStructured,
  generateWithRepair,
  type StructuredOpenAiCaller,
} from "../_lib/openai";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/** 요약문이 쓸 수 있는 스타일 신호 근거. 그룹 요약은 여기서만 고르게 해 규칙 위반 자체를 막는다. */
function styleEvidenceRefs(input: StyleDnaExplanationRequest) {
  return input.members.flatMap((member) => {
    const prefix = member.memberId;
    return [
      `${prefix}.preferredStyle`,
      `${prefix}.keywords`,
      `${prefix}.designElements`,
      `${prefix}.preferredItems`,
      ...Object.keys(member.styleScores).map(
        (style) => `${prefix}.styleScores.${style}`,
      ),
    ];
  });
}

function contextEvidenceRefs(input: StyleDnaExplanationRequest) {
  return input.members.flatMap((member) => {
    const prefix = member.memberId;
    return [
      ...member.form.fitConcerns.map((_, index) => `${prefix}.fitConcerns.${index}`),
      `${prefix}.budgetRange`,
      `${prefix}.budgetApproach`,
      `${prefix}.tpo`,
    ];
  });
}

function evidenceCatalog(input: StyleDnaExplanationRequest) {
  return [...styleEvidenceRefs(input), ...contextEvidenceRefs(input)];
}

/**
 * evidenceRefs는 사용자에게 보이지 않는 내부 검증용이다.
 * 하나 틀렸다고 문장 전체를 버리지 않고, 입력에 없는 값만 걸러낸 뒤 남은 근거로 판정한다.
 */
function sanitizeRefs(refs: string[], allowed: Set<string>, field: string) {
  const kept = refs.filter((ref) => allowed.has(ref));
  if (kept.length === 0) {
    throw new Error(`${field}의 근거가 모두 입력에 없는 값입니다.`);
  }
  return kept;
}

/**
 * 사용자가 실제로 고른 단어만 모은다.
 * 모델이 고르지도 않은 아이템·소재·색상을 선호한다고 단정하는 것을 막기 위한 허용 어휘다.
 */
function selectedVocabulary(input: StyleDnaExplanationRequest) {
  return input.members.map((member) => ({
    memberId: member.memberId,
    preferredStyle: member.form.preferredStyle,
    keywords: member.form.keywords,
    designElements: member.form.designElements,
    preferredItems: member.form.preferredItems,
    fitConcerns: member.form.fitConcerns,
    budgetApproach: member.form.budgetApproach,
    tpo: tpoLabel(member.form.tpo),
  }));
}

/** 모델에게는 TPO 내부 코드 대신 사람이 읽는 라벨을 보낸다. */
function withTpoLabels(input: StyleDnaExplanationRequest) {
  return {
    ...input,
    members: input.members.map((member) => ({
      ...member,
      form: { ...member.form, tpo: tpoLabel(member.form.tpo) },
    })),
  };
}

export function combinationMetricText(compatibility: {
  styleSimilarity: number;
  budgetCompatibility: number;
}) {
  return `스타일 방향 유사도 ${compatibility.styleSimilarity}/70 · 예산 조율 가능성 ${compatibility.budgetCompatibility}/30.`;
}

function validateResult(
  input: StyleDnaExplanationRequest,
  result: unknown,
): StyleDnaExplanationResponse {
  const allowed = new Set(evidenceCatalog(input));
  const summaryAllowed = new Set(styleEvidenceRefs(input));
  const validated = validateStyleDnaExplanation(result, input.groupCompatibility);
  if (validated.mode !== input.mode) {
    throw new Error("OpenAI가 진단 모드를 변경했습니다.");
  }
  if (validated.mode === "personal") {
    const personalTexts = [
      validated.personalStyleDnaSummary,
      ...validated.personalMatchingPoints.map((point: EvidenceText) => point.text),
    ];
    assertSafeLanguage(personalTexts);
    assertGrounded(personalTexts, input.members.map((member) => member.form));
    validated.personalStyleDnaSummaryEvidenceRefs = sanitizeRefs(
      validated.personalStyleDnaSummaryEvidenceRefs,
      allowed,
      "개인 요약",
    );
    validated.personalMatchingPoints = validated.personalMatchingPoints.map(
      (point: EvidenceText) => ({
        ...point,
        evidenceRefs: sanitizeRefs(point.evidenceRefs, allowed, "매칭 포인트"),
      }),
    );
    return validated;
  }
  const compatibility = input.groupCompatibility;
  if (!compatibility) throw new Error("그룹 조합 계산값이 없습니다.");
  const group = validated as GroupStyleDnaExplanation;
  const groupTexts = [
    group.groupStyleDnaSummary,
    group.groupCombination.title,
    group.groupCombination.description,
    ...group.groupMatchingPoints.map((point) => point.text),
  ];
  assertSafeLanguage(groupTexts);
  assertGrounded(groupTexts, input.members.map((member) => member.form));
  // 요약은 스타일 신호만 근거로 쓰게 허용 목록 자체를 좁힌다.
  group.groupStyleDnaSummaryEvidenceRefs = sanitizeRefs(
    group.groupStyleDnaSummaryEvidenceRefs,
    summaryAllowed,
    "그룹 요약",
  );
  if (
    !group.groupStyleDnaSummaryEvidenceRefs.some((ref) => ref.startsWith("A.")) ||
    !group.groupStyleDnaSummaryEvidenceRefs.some((ref) => ref.startsWith("B."))
  ) {
    throw new Error("그룹 Style DNA 요약은 A와 B의 스타일 신호를 모두 근거로 사용해야 합니다.");
  }
  group.groupCombination.evidenceRefs = sanitizeRefs(
    group.groupCombination.evidenceRefs,
    allowed,
    "그룹 조합 설명",
  );
  group.groupMatchingPoints = group.groupMatchingPoints.map((point) => ({
    ...point,
    evidenceRefs: sanitizeRefs(point.evidenceRefs, allowed, "매칭 포인트"),
  }));
  // 수치는 규칙 엔진 값만 쓰고, 조율 방향 설명은 AI 문장을 유지한다.
  const guidance = group.groupCombination.description.trim();
  if (/\d+\s*\/\s*(70|30)|\d+\s*점/.test(guidance)) {
    throw new Error("그룹 조합 설명은 수치 없이 조율 방향만 작성해야 합니다.");
  }
  group.groupCombination.description = `${combinationMetricText(compatibility)} ${guidance}`;
  return group;
}

export async function createStyleDnaExplanation(
  input: StyleDnaExplanationRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<StyleDnaExplanationResponse> {
  return generateWithRepair(
    generate,
    {
      schemaName: `biasfit_${input.mode}_style_dna`,
      schema:
        input.mode === "personal" ? personalStyleDnaSchema : groupStyleDnaSchema,
      systemPrompt: [
        "BiasFit Style DNA 계산 결과를 사용자가 이해하기 쉬운 한국어로 설명한다.",
        "점수, 예산, 우선순위와 그룹 조합 수치를 절대 변경하지 않는다.",
        "요약은 마침표 없이 '스타일'로 끝내는 명사형 한 문장으로 쓴다.",
        "개인 요약은 공백 포함 15~35자다. 예: '자연스러운 일상감에 부드러운 분위기를 더한 스타일'(26자), '단정한 인상과 활용도를 함께 고려한 스타일'(22자), '편안한 착용감과 균형 잡힌 비율을 우선한 스타일'(25자).",
        "그룹 요약은 공백 포함 20~45자이며 A와 B의 스타일 신호가 각각 드러나야 한다. 예: '자연스러운 A와 부드러운 B를 함께 살린 스타일'(25자).",
        "글자 수를 세어 범위 안에 들어오는지 확인한 뒤 답한다.",
        GROUNDING_RULES,
        "매칭 중요 포인트는 2~3개를 반환하고, 각 문장은 '~해요'체로 인플루언서가 무엇을 잘 다뤄야 하는지를 쓴다.",
        "'피하는 것이 좋습니다', '입지 마세요'처럼 특정 옷을 피하라고 권하는 표현을 쓰지 않는다.",
        "피하고 싶은 스타일이나 피하고 싶은 요소를 설명 근거로 직접 언급하지 않는다.",
        SAFE_LANGUAGE_RULES,
        "요약문에도 실제 근거를 summaryEvidenceRefs로 반드시 반환한다. 요약의 근거는 summaryAllowedEvidenceRefs에서만 고르고, 나머지 문장의 근거는 allowedEvidenceRefs에서만 고른다.",
        "그룹 요약의 summaryEvidenceRefs에는 'A.'로 시작하는 값과 'B.'로 시작하는 값을 각각 최소 하나씩 넣는다.",
        "그룹 조합 제목(groupCombination.title)은 공백 포함 8~24자다. 예: '각자의 무드를 살린 연결'(13자), '두 무드를 잇는 조합'(11자).",
        "그룹 조합 설명(description)에는 점수 수치를 쓰지 않고, 두 사람이 함께 코디할 때의 조율 방향만 1~2문장으로 쓴다. 수치 문구는 서버가 앞에 붙인다.",
        "낮은 조합도를 실패·부적합으로 표현하지 않고, 같은 스타일로 맞춰 입으라고 하지 않는다.",
      ].join(" "),
      input: {
        ...withTpoLabels(input),
        allowedEvidenceRefs: evidenceCatalog(input),
        summaryAllowedEvidenceRefs: styleEvidenceRefs(input),
        selectedVocabulary: selectedVocabulary(input),
      },
    },
    (result) => validateResult(input, result),
    { label: "AI2" },
  );
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json(
      await createStyleDnaExplanation(
        readJsonBody(request) as StyleDnaExplanationRequest,
      ),
    );
  } catch (error) {
    console.error("[BiasFit AI2] style-dna-explanation failed", error);
    sendApiError(response, error);
  }
}
