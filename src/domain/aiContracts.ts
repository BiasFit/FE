import type {
  DiagnosisForm,
  MatchPriority,
  PriorityOption,
} from "../app/types.js";
import type {
  MatchBreakdown,
  MatchedEvidence,
  StyleScores,
} from "./scoring.js";

export const PRIORITY_QUESTION =
  "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요." as const;

export const MATCH_PRIORITIES: MatchPriority[] = [
  "style_first",
  "fit_first",
  "budget_first",
  "tpo_first",
];

export interface EvidenceText {
  text: string;
  evidenceRefs: string[];
}

export interface PriorityOptionsRequest {
  mode: "personal" | "group";
  personal: DiagnosisForm;
  group: {
    relationship: "friend" | "family" | "other";
    relationshipOther: string;
    tpo: string;
    members: Record<"A" | "B", DiagnosisForm>;
  };
}

export interface PriorityOptionsResponse {
  question: typeof PRIORITY_QUESTION;
  options: PriorityOption[];
}

export interface StyleDnaMemberInput {
  memberId: "self" | "A" | "B";
  form: DiagnosisForm;
  styleScores: StyleScores;
}

export interface StyleDnaExplanationRequest {
  mode: "personal" | "group";
  priority: MatchPriority;
  members: StyleDnaMemberInput[];
  groupCompatibility?: {
    styleSimilarity: number;
    budgetCompatibility: number;
    total: number;
  };
}

export interface PersonalStyleDnaExplanation {
  mode: "personal";
  personalStyleDnaSummary: string;
  personalStyleDnaSummaryEvidenceRefs: string[];
  personalMatchingPoints: EvidenceText[];
}

export interface GroupStyleDnaExplanation {
  mode: "group";
  groupStyleDnaSummary: string;
  groupStyleDnaSummaryEvidenceRefs: string[];
  groupCombination: {
    score: number;
    directionSimilarity: number;
    budgetCoordination: number;
    title: string;
    description: string;
    evidenceRefs: string[];
  };
  groupMatchingPoints: EvidenceText[];
}

export type StyleDnaExplanationResponse =
  | PersonalStyleDnaExplanation
  | GroupStyleDnaExplanation;

export interface MatchExplanationCandidate {
  influencerId: string;
  rank: number;
  matchScore: number;
  breakdown: MatchBreakdown;
  matchedEvidence: MatchedEvidence;
}

export interface MatchExplanationsRequest {
  mode: "personal" | "group";
  priority: MatchPriority;
  rankedInfluencers: MatchExplanationCandidate[];
}

export interface MatchExplanation {
  influencerId: string;
  strongestCategory: "style" | "fit" | "budget" | "tpo";
  summary: string;
  evidenceRefs: string[];
}

export interface MatchExplanationsResponse {
  explanations: MatchExplanation[];
}

export type ReviewStatus =
  | "pass"
  | "needs_revision"
  | "operations_review"
  | "blocked";

export interface SafeLanguageIssue {
  field: "coaching_message";
  phrase: string;
  reason: string;
  suggestedRewrite: string;
}

export interface LinkCheck {
  itemType: "top" | "bottom";
  memberId: "self" | "A" | "B";
  inputUrl: string;
  finalUrl: string | null;
  status: "pass" | "needs_revision" | "operations_review" | "failed";
  reason: string;
  action: "조치 없음" | "운영진 검토" | "링크 수정";
}

export interface OutfitReviewRequest {
  mode: "personal" | "group";
  coachingMessage: string;
  cards: Array<{
    memberId: "self" | "A" | "B";
    top: { name: string; url: string };
    bottom: { name: string; url: string };
  }>;
}

export interface OutfitReviewResponse {
  reviewStatus: ReviewStatus;
  safeLanguageIssues: SafeLanguageIssue[];
  linkChecks: LinkCheck[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEvidenceText(value: unknown): value is EvidenceText {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    value.text.trim().length > 0 &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0
  );
}

export function isMatchPriority(value: unknown): value is MatchPriority {
  return MATCH_PRIORITIES.includes(value as MatchPriority);
}

export function isPriorityOptionsResponse(
  value: unknown,
): value is PriorityOptionsResponse {
  if (
    !isRecord(value) ||
    value.question !== PRIORITY_QUESTION ||
    !Array.isArray(value.options) ||
    value.options.length !== MATCH_PRIORITIES.length
  ) {
    return false;
  }
  const codes = new Set<string>();
  for (const option of value.options) {
    if (
      !isRecord(option) ||
      !isMatchPriority(option.code) ||
      typeof option.label !== "string" ||
      option.label.trim().length === 0 ||
      !isStringArray(option.evidenceRefs) ||
      option.evidenceRefs.length === 0
    ) {
      return false;
    }
    codes.add(option.code);
  }
  return MATCH_PRIORITIES.every((code) => codes.has(code));
}

function validateSummary(summary: unknown, min: number, max: number) {
  if (
    typeof summary !== "string" ||
    summary.length < min ||
    summary.length > max ||
    !summary.endsWith("스타일") ||
    summary.endsWith(".")
  ) {
    throw new Error(`Style DNA summary must be ${min}-${max} characters and end with 스타일`);
  }
}

function validateEvidenceRefs(value: unknown, field: string) {
  if (!isStringArray(value) || value.length === 0) {
    throw new Error(`${field} requires non-empty evidenceRefs`);
  }
}

function validatePoints(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    throw new Error(`${field} must contain 2-3 points`);
  }
  if (!value.every(isEvidenceText)) {
    throw new Error(`${field} requires non-empty evidenceRefs`);
  }
}

export const GROUP_COMBINATION_TITLE_MIN = 8;
export const GROUP_COMBINATION_TITLE_MAX = 24;

export function validateStyleDnaExplanation(
  value: unknown,
  groupCompatibility?: StyleDnaExplanationRequest["groupCompatibility"],
): StyleDnaExplanationResponse {
  if (!isRecord(value)) throw new Error("Style DNA response must be an object");
  if (value.mode === "personal") {
    validateSummary(value.personalStyleDnaSummary, 15, 35);
    validateEvidenceRefs(
      value.personalStyleDnaSummaryEvidenceRefs,
      "personalStyleDnaSummary",
    );
    validatePoints(value.personalMatchingPoints, "personalMatchingPoints");
    return value as unknown as PersonalStyleDnaExplanation;
  }
  if (value.mode === "group") {
    validateSummary(value.groupStyleDnaSummary, 20, 45);
    validateEvidenceRefs(
      value.groupStyleDnaSummaryEvidenceRefs,
      "groupStyleDnaSummary",
    );
    validatePoints(value.groupMatchingPoints, "groupMatchingPoints");
    if (!isRecord(value.groupCombination)) {
      throw new Error("groupCombination is required");
    }
    const combination = value.groupCombination;
    if (
      typeof combination.title !== "string" ||
      combination.title.length < GROUP_COMBINATION_TITLE_MIN ||
      combination.title.length > GROUP_COMBINATION_TITLE_MAX
    ) {
      throw new Error(
        `groupCombination.title must be ${GROUP_COMBINATION_TITLE_MIN}-${GROUP_COMBINATION_TITLE_MAX} characters`,
      );
    }
    if (
      typeof combination.description !== "string" ||
      !combination.description.trim() ||
      !isStringArray(combination.evidenceRefs) ||
      combination.evidenceRefs.length === 0
    ) {
      throw new Error("groupCombination is invalid");
    }
    // 조합도 수치는 모델 응답이 아니라 규칙 엔진 계산값으로만 채운다.
    if (!groupCompatibility) throw new Error("그룹 조합 계산값이 없습니다.");
    combination.score = groupCompatibility.total;
    combination.directionSimilarity = groupCompatibility.styleSimilarity;
    combination.budgetCoordination = groupCompatibility.budgetCompatibility;
    const refs = [
      ...(value.groupStyleDnaSummaryEvidenceRefs as string[]),
      ...combination.evidenceRefs,
      ...(value.groupMatchingPoints as EvidenceText[]).flatMap(
        (point) => point.evidenceRefs,
      ),
    ];
    if (!refs.some((ref) => ref.startsWith("A.")) || !refs.some((ref) => ref.startsWith("B."))) {
      throw new Error("group explanation requires A and B evidenceRefs");
    }
    return value as unknown as GroupStyleDnaExplanation;
  }
  throw new Error("Style DNA response mode is invalid");
}

const MATCH_CATEGORY_ORDER: MatchExplanation["strongestCategory"][] = [
  "style",
  "fit",
  "budget",
  "tpo",
];

/**
 * 후보의 최고 적합 항목을 규칙 엔진 점수만으로 결정한다.
 * 동점이면 스타일 > 핏 > 예산 > TPO 순서로 고정한다.
 */
export function strongestMatchCategory(breakdown: MatchBreakdown) {
  return MATCH_CATEGORY_ORDER.reduce((strongest, category) =>
    breakdown[category] > breakdown[strongest] ? category : strongest,
  );
}

export function validateMatchExplanations(
  value: unknown,
  request: MatchExplanationsRequest,
): MatchExplanationsResponse {
  if (!isRecord(value) || !Array.isArray(value.explanations)) {
    throw new Error("explanations are required");
  }
  if (value.explanations.length !== request.rankedInfluencers.length) {
    throw new Error("explanations must match the fixed TOP 3 candidates");
  }
  const candidates = new Map(
    request.rankedInfluencers.map((candidate) => [candidate.influencerId, candidate]),
  );
  const ranks = new Set<number>();
  for (const candidate of request.rankedInfluencers) {
    if (
      candidate.rank < 1 ||
      candidate.rank > request.rankedInfluencers.length ||
      ranks.has(candidate.rank) ||
      candidate.matchScore !== candidate.breakdown.matchScore
    ) {
      throw new Error("fixed TOP 3 score or rank is invalid");
    }
    ranks.add(candidate.rank);
  }
  const seen = new Set<string>();
  const explanations: MatchExplanation[] = [];
  for (const explanation of value.explanations) {
    if (
      !isRecord(explanation) ||
      typeof explanation.influencerId !== "string" ||
      typeof explanation.summary !== "string" ||
      !explanation.summary.trim() ||
      !isStringArray(explanation.evidenceRefs) ||
      explanation.evidenceRefs.length === 0
    ) {
      throw new Error("match explanation is invalid");
    }
    const candidate = candidates.get(explanation.influencerId);
    if (!candidate || seen.has(explanation.influencerId)) {
      throw new Error("AI changed the fixed TOP 3 candidates");
    }
    const allowedRefs = new Set(
      Object.values(candidate.matchedEvidence)
        .flat()
        .map((evidence) => evidence.ref),
    );
    if (!explanation.evidenceRefs.every((ref) => allowedRefs.has(ref))) {
      throw new Error("AI used evidence outside the calculated match result");
    }
    if (request.mode === "group") {
      const hasA = explanation.evidenceRefs.some((ref) => ref.startsWith("A."));
      const hasB = explanation.evidenceRefs.some((ref) => ref.startsWith("B."));
      if (!hasA || !hasB) {
        throw new Error("group explanation requires A and B evidenceRefs");
      }
    }
    seen.add(explanation.influencerId);
    // 최고 적합 항목은 규칙 엔진 계산값만 사용하고, AI 응답의 값은 신뢰하지 않는다.
    explanations.push({
      influencerId: explanation.influencerId,
      strongestCategory: strongestMatchCategory(candidate.breakdown),
      summary: explanation.summary,
      evidenceRefs: explanation.evidenceRefs,
    });
  }
  return { explanations };
}

export const priorityOptionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string", const: PRIORITY_QUESTION },
    options: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", enum: MATCH_PRIORITIES },
          label: {
            type: "string",
            description:
              "사용자가 1인칭으로 말하듯 쓴 한 문장. 항목 이름만 적지 말고 이번 입력값을 반영한다. 예: '좋아하는 빈티지한 분위기를 가장 먼저 지키고 싶어요'",
          },
          evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["code", "label", "evidenceRefs"],
      },
    },
  },
  required: ["question", "options"],
} as const;

const evidenceTextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
  },
  required: ["text", "evidenceRefs"],
} as const;

export const personalStyleDnaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", const: "personal" },
    personalStyleDnaSummary: { type: "string" },
    personalStyleDnaSummaryEvidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
    personalMatchingPoints: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: evidenceTextSchema,
    },
  },
  required: ["mode", "personalStyleDnaSummary", "personalStyleDnaSummaryEvidenceRefs", "personalMatchingPoints"],
} as const;

export const groupStyleDnaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", const: "group" },
    groupStyleDnaSummary: { type: "string" },
    groupStyleDnaSummaryEvidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
    // score·directionSimilarity·budgetCoordination은 규칙 엔진 계산값이므로 모델에게 받지 않고 서버가 채운다.
    groupCombination: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: {
          type: "string",
          description:
            "그룹 스타일 조합도 제목. 공백 포함 8~24자. 예: '각자의 무드를 살린 연결'(13자)",
        },
        description: {
          type: "string",
          description: "점수 수치 없이 조율 방향만 담은 1~2문장",
        },
        evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
      },
      required: ["title", "description", "evidenceRefs"],
    },
    groupMatchingPoints: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: evidenceTextSchema,
    },
  },
  required: [
    "mode",
    "groupStyleDnaSummary",
    "groupStyleDnaSummaryEvidenceRefs",
    "groupCombination",
    "groupMatchingPoints",
  ],
} as const;

export const matchExplanationsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          influencerId: { type: "string" },
          summary: { type: "string" },
          evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["influencerId", "summary", "evidenceRefs"],
      },
    },
  },
  required: ["explanations"],
} as const;

export const safeLanguageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", const: "coaching_message" },
          phrase: { type: "string" },
          reason: { type: "string" },
          suggestedRewrite: { type: "string" },
        },
        required: ["field", "phrase", "reason", "suggestedRewrite"],
      },
    },
  },
  required: ["issues"],
} as const;

export type JsonSchema = Record<string, unknown>;
