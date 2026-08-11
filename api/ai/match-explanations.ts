import {
  matchExplanationsSchema,
  strongestMatchCategory,
  validateMatchExplanations,
  type MatchExplanationsRequest,
  type MatchExplanationsResponse,
} from "../../src/domain/aiContracts";
import {
  callOpenAiStructured,
  generateWithRepair,
  type StructuredOpenAiCaller,
} from "../_lib/openai";
import { SAFE_LANGUAGE_RULES, assertSafeLanguage } from "../_lib/safe-language";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

const CATEGORY_LABEL = {
  style: "스타일 취향 일치도",
  fit: "핏 고민 대응도",
  budget: "예산 적합도",
  tpo: "TPO 적합도",
} as const;

/**
 * 최고 적합 항목과 사용 가능한 근거는 규칙 엔진 계산값이므로 모델에게 묻지 않고 입력으로 내려준다.
 * 모델은 문장(summary)과 그 문장이 실제로 쓴 근거(evidenceRefs)만 만든다.
 */
function modelInput(input: MatchExplanationsRequest) {
  return {
    mode: input.mode,
    priority: input.priority,
    candidates: input.rankedInfluencers.map((candidate) => {
      const strongestCategory = strongestMatchCategory(candidate.breakdown);
      return {
        influencerId: candidate.influencerId,
        rank: candidate.rank,
        strongestCategory,
        strongestCategoryLabel: CATEGORY_LABEL[strongestCategory],
        matchedEvidence: candidate.matchedEvidence,
        allowedEvidenceRefs: Object.values(candidate.matchedEvidence)
          .flat()
          .map((evidence) => evidence.ref),
      };
    }),
  };
}

export async function createMatchExplanations(
  input: MatchExplanationsRequest,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
): Promise<MatchExplanationsResponse> {
  return generateWithRepair(
    generate,
    {
      schemaName: "biasfit_match_explanations",
      schema: matchExplanationsSchema,
      systemPrompt: [
        "BiasFit 규칙 엔진이 확정한 TOP 3 추천 근거만 설명한다.",
        "후보, 순위, 점수, 항목별 계산값을 추가하거나 변경하지 않는다.",
        "각 후보마다 입력으로 주어진 strongestCategory를 그 후보가 가장 잘 맞은 항목으로 삼아 설명한다. 다른 항목을 가장 강한 이유로 바꾸지 않는다.",
        "summary는 해당 항목에서 실제로 일치한 matchedEvidence의 내용을 담아 1~2문장의 자연스러운 한국어 존댓말로 쓴다.",
        "다른 조건도 함께 검토되었다는 사실이 드러나게 하되, 무시했다는 인상을 주지 않는다.",
        "matchedEvidence의 style 항목은 인플루언서의 대표 스타일이지 사용자의 선호가 아니다. '캐주얼을 선호하시며'처럼 사용자를 주어로 쓰지 말고, '이 스타일메이트는 캐주얼을 대표 스타일로 다뤄요'처럼 인플루언서를 주어로 쓴다.",
        "evidenceRefs에는 그 후보의 allowedEvidenceRefs에 있는 문자열만 담는다. 다른 경로나 지어낸 값은 금지한다.",
        "그룹이면 evidenceRefs에 A로 시작하는 근거와 B로 시작하는 근거를 각각 최소 하나씩 포함한다.",
        "점수 숫자나 내부 코드를 문장에 쓰지 않는다. '캐주얼 75점', '예산 코드 2'처럼 쓰지 말고 사용자가 이해할 수 있는 말로 바꾼다.",
        SAFE_LANGUAGE_RULES,
        "입력에 있는 모든 후보를 각각 한 번씩만 반환한다.",
      ].join(" "),
      input: modelInput(input),
    },
    (result) => {
      const validated = validateMatchExplanations(result, input);
      assertSafeLanguage(validated.explanations.map((item) => item.summary));
      return validated;
    },
    { label: "AI4" },
  );
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json(
      await createMatchExplanations(
        readJsonBody(request) as MatchExplanationsRequest,
      ),
    );
  } catch (error) {
    console.error("[BiasFit AI4] match-explanations failed", error);
    sendApiError(response, error);
  }
}
