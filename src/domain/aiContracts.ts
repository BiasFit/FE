import type {
  DiagnosisForm,
  MatchPriority,
  PriorityOption,
} from "../app/types";
import type {
  MatchBreakdown,
  MatchedEvidence,
  StyleScores,
} from "./scoring";

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
  memberId: "personal" | "A" | "B";
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
  personalMatchingPoints: EvidenceText[];
}

export interface GroupStyleDnaExplanation {
  mode: "group";
  groupStyleDnaSummary: string;
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
  memberId: "personal" | "A" | "B";
  inputUrl: string;
  finalUrl: string | null;
  status: "pass" | "operations_review" | "failed";
  reason: string;
  action: "조치 없음" | "운영진 검토" | "링크 수정";
}

export interface OutfitReviewRequest {
  mode: "personal" | "group";
  coachingMessage: string;
  cards: Array<{
    memberId: "personal" | "A" | "B";
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

function validatePoints(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    throw new Error(`${field} must contain 2-3 points`);
  }
  if (!value.every(isEvidenceText)) {
    throw new Error(`${field} requires non-empty evidenceRefs`);
  }
}

export function validateStyleDnaExplanation(
  value: unknown,
): StyleDnaExplanationResponse {
  if (!isRecord(value)) throw new Error("Style DNA response must be an object");
  if (value.mode === "personal") {
    validateSummary(value.personalStyleDnaSummary, 15, 35);
    validatePoints(value.personalMatchingPoints, "personalMatchingPoints");
    return value as unknown as PersonalStyleDnaExplanation;
  }
  if (value.mode === "group") {
    validateSummary(value.groupStyleDnaSummary, 20, 45);
    validatePoints(value.groupMatchingPoints, "groupMatchingPoints");
    if (!isRecord(value.groupCombination)) {
      throw new Error("groupCombination is required");
    }
    const combination = value.groupCombination;
    if (
      typeof combination.score !== "number" ||
      typeof combination.directionSimilarity !== "number" ||
      typeof combination.budgetCoordination !== "number" ||
      typeof combination.title !== "string" ||
      combination.title.length < 8 ||
      combination.title.length > 24 ||
      typeof combination.description !== "string" ||
      !isStringArray(combination.evidenceRefs) ||
      combination.evidenceRefs.length === 0
    ) {
      throw new Error("groupCombination is invalid");
    }
    const refs = [
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
  const seen = new Set<string>();
  for (const explanation of value.explanations) {
    if (
      !isRecord(explanation) ||
      typeof explanation.influencerId !== "string" ||
      !["style", "fit", "budget", "tpo"].includes(
        explanation.strongestCategory as string,
      ) ||
      typeof explanation.summary !== "string" ||
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
  }
  return value as unknown as MatchExplanationsResponse;
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
          label: { type: "string" },
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
    personalMatchingPoints: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: evidenceTextSchema,
    },
  },
  required: ["mode", "personalStyleDnaSummary", "personalMatchingPoints"],
} as const;

export const groupStyleDnaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", const: "group" },
    groupStyleDnaSummary: { type: "string" },
    groupCombination: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        directionSimilarity: { type: "number" },
        budgetCoordination: { type: "number" },
        title: { type: "string" },
        description: { type: "string" },
        evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
      },
      required: [
        "score",
        "directionSimilarity",
        "budgetCoordination",
        "title",
        "description",
        "evidenceRefs",
      ],
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
          strongestCategory: {
            type: "string",
            enum: ["style", "fit", "budget", "tpo"],
          },
          summary: { type: "string" },
          evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: [
          "influencerId",
          "strongestCategory",
          "summary",
          "evidenceRefs",
        ],
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
