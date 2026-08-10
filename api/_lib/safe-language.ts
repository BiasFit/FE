import {
  safeLanguageSchema,
  type SafeLanguageIssue,
} from "../../src/domain/aiContracts";
import {
  callOpenAiStructured,
  type StructuredOpenAiCaller,
} from "./openai";

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
