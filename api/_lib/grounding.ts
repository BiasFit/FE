import type { DiagnosisForm } from "../../src/app/types";
import { STYLE_NAMES, type StyleName } from "../../src/domain/scoring";

/**
 * evidenceRefs는 참조가 존재하는지만 검사하고, 그 참조가 가리키는 값과 문장이
 * 실제로 맞는지는 보지 않는다. 그래서 캐주얼·오피스 사용자에게 "빈티지"라고 써도 통과했다.
 * 여기서는 문장에 나온 스타일 이름과 색상·소재 단어가 실제 선택값에 있는지 확인한다.
 */

/** "비즈니스캐주얼"이 "캐주얼"로 잡히지 않도록 스타일마다 인식 패턴을 따로 둔다. */
const STYLE_PATTERNS: Record<StyleName, RegExp> = {
  캐주얼: /(?<!비즈니스)캐주얼/,
  로맨틱: /로맨틱/,
  스트릿: /스트릿/,
  빈티지: /빈티지/,
  "오피스 & 비즈니스캐주얼": /오피스|비즈니스캐주얼/,
};

/** 사용자가 고를 수 있는 색상·소재 표현. 목록에 없는 자유 표현은 프롬프트로만 다룬다. */
const COLOR_MATERIAL_WORDS = [
  "수채화 색감",
  "더스티 컬러",
  "강렬한 컬러조합",
  "무채색",
  "쉬폰",
  "빳빳한 소재감",
  "데님 소재감",
  "빈티지 워싱",
];

function selectedWords(form: DiagnosisForm) {
  return [...form.keywords, ...form.designElements, ...form.preferredItems];
}

/**
 * 사용자가 언급해도 되는 스타일.
 * 직접 고른 선호 스타일과, 선택한 옵션 이름에 그 스타일 이름이 들어간 경우를 포함한다.
 * (예: "빈티지 워싱"을 골랐다면 "빈티지"를 말해도 된다.)
 */
function allowedStyles(forms: DiagnosisForm[]) {
  const allowed = new Set<StyleName>();
  for (const form of forms) {
    allowed.add(form.preferredStyle);
    for (const style of STYLE_NAMES) {
      if (selectedWords(form).some((word) => word.includes(style))) allowed.add(style);
    }
  }
  return allowed;
}

export function findUngroundedTerms(text: string, forms: DiagnosisForm[]) {
  const allowed = allowedStyles(forms);
  const found: string[] = [];

  for (const style of STYLE_NAMES) {
    if (allowed.has(style)) continue;
    if (STYLE_PATTERNS[style].test(text)) {
      found.push(`${style} (아무도 고르지 않은 스타일)`);
    }
  }

  const chosen = new Set(forms.flatMap(selectedWords));
  for (const word of COLOR_MATERIAL_WORDS) {
    if (!chosen.has(word) && text.includes(word)) {
      found.push(`${word} (고르지 않은 색상·소재)`);
    }
  }

  return found;
}

/** 근거 없는 표현이 하나라도 있으면 재시도하도록 예외를 던진다. */
export function assertGrounded(texts: string[], forms: DiagnosisForm[]) {
  const found = [...new Set(texts.flatMap((text) => findUngroundedTerms(text, forms)))];
  if (found.length > 0) {
    throw new Error(
      `사용자가 고르지 않은 내용을 문장에 넣을 수 없습니다: ${found.join(", ")}`,
    );
  }
}

/** AI1·AI2 프롬프트가 공통으로 쓰는 지시. */
export const GROUNDING_RULES = [
  "selectedVocabulary는 사용자가 실제로 고른 값이다. 문장에 쓰는 스타일 이름·아이템·소재·색상은 이 목록 안에서만 고른다.",
  "목록에 없는 스타일 이름을 언급하지 않는다. 피하고 싶은 스타일은 어떤 경우에도 언급하지 않는다.",
  "사용자가 색상이나 소재를 고르지 않았다면 색상·소재를 문장에 넣지 않는다. 골랐다면 그 표현의 의미 범위 안에서만 쓴다.",
].join(" ");
