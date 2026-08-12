import {
  safeLanguageSchema,
  type SafeLanguageIssue,
} from "../../src/domain/aiContracts";
import {
  callOpenAiStructured,
  type StructuredOpenAiCaller,
} from "./openai";

/**
 * AI1·AI2·AI4가 공통으로 쓰는 안전 표현 지시.
 * STYLE_SCORING_DRAFT 7.6과 STYLE_DNA_AI_FUNCTIONS 6.2의 금지 표현을 옮긴 것이다.
 */
export const SAFE_LANGUAGE_RULES = [
  "외모·몸매·체형을 평가하거나 교정 대상으로 다루지 않는다.",
  "'다리가 길어 보이게', '다리가 짧아 보이지 않게', '날씬해 보이게', '살쪄 보이지 않게', '단점을 가려', '몸매 보완'처럼 몸을 보정한다는 표현을 쓰지 않는다. 부정형으로 바꿔도 금지다.",
  "체형 등급·점수·예쁜 체형 같은 서열 표현을 쓰지 않는다.",
  "대신 사용자가 원하는 착용감·분위기·활용도를 기준으로 쓴다. 예: '편안한 착용감', '전체 기장 균형', '단정한 인상'.",
  "'반드시', '정답', '실패', '부적합'처럼 강요하거나 판정하는 표현을 쓰지 않는다.",
  "다른 사람과 비교하지 않는다.",
].join(" ");

/**
 * 프롬프트만으로는 새는 표현이 있어 결정적 검사를 함께 둔다.
 * 관찰된 위반이 대부분 부정형 변형이었으므로 어휘가 아니라 패턴으로 잡는다.
 */
const UNSAFE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /다리[가는]?\s*(더\s*)?(길|짧)[어아]\s*보이/, reason: "다리 길이를 평가하는 표현" },
  { pattern: /날씬(해|하게)?\s*보이|말라\s*보이/, reason: "체형을 평가하는 표현" },
  { pattern: /살(쪄|찐)\s*보이|뚱뚱/, reason: "체형을 비하할 수 있는 표현" },
  { pattern: /몸매/, reason: "몸매 평가 표현" },
  { pattern: /(단점|결점)[을는이가]?\s*(가리|가려|커버|보완|감추)/, reason: "몸을 결함으로 다루는 표현" },
  { pattern: /체형\s*(등급|점수)|예쁜\s*체형/, reason: "체형을 서열화하는 표현" },
  { pattern: /키[가는]?\s*(더\s*)?(커|작아)\s*보이/, reason: "신체를 보정 대상으로 다루는 표현" },
];

/** 사용자에게 보이는 문장에서 금지 표현을 찾는다. 없으면 빈 배열이다. */
export function findUnsafePhrases(text: string) {
  return UNSAFE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ pattern, reason }) => `${text.match(pattern)?.[0] ?? ""} (${reason})`,
  );
}

/** 검사 대상 문장들 중 하나라도 걸리면 재시도하도록 예외를 던진다. */
export function assertSafeLanguage(texts: string[]) {
  const found = texts.flatMap((text) => findUnsafePhrases(text));
  if (found.length > 0) {
    throw new Error(
      `외모·체형을 평가하는 표현은 쓸 수 없습니다: ${found.join(", ")}`,
    );
  }
}

function validateIssues(value: unknown, original: string) {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { issues?: unknown }).issues)
  ) {
    throw new Error("안전 표현 검수 응답이 올바르지 않습니다.");
  }
  const issues = (value as { issues: unknown[] }).issues;
  for (const issue of issues) {
    if (
      typeof issue !== "object" ||
      issue === null ||
      (issue as { field?: unknown }).field !== "coaching_message" ||
      typeof (issue as { phrase?: unknown }).phrase !== "string" ||
      !(issue as { phrase: string }).phrase.trim() ||
      !original.includes((issue as { phrase: string }).phrase) ||
      typeof (issue as { reason?: unknown }).reason !== "string" ||
      typeof (issue as { suggestedRewrite?: unknown }).suggestedRewrite !== "string"
    ) {
      throw new Error("안전 표현 검수 근거가 원문과 일치하지 않습니다.");
    }
  }
  return issues as SafeLanguageIssue[];
}

export async function reviewSafeLanguage(
  coachingMessage: string,
  generate: StructuredOpenAiCaller = callOpenAiStructured,
) {
  const result = await generate({
    schemaName: "biasfit_safe_language_review",
    schema: safeLanguageSchema,
    systemPrompt: [
      "BiasFit 코디 카드 문구의 안전 표현만 검수한다.",
      "외모·몸매 평가, 결함·교정, 비하·낙인, 타인 비교, 강요·절대화 표현을 찾는다.",
      "문구를 자동 수정하지 않고 정확한 원문 구절, 이유, 중립적 수정 제안만 반환한다.",
      "문제가 없으면 issues를 빈 배열로 반환한다.",
    ].join(" "),
    input: { coachingMessage },
  });
  return { issues: validateIssues(result, coachingMessage) };
}
