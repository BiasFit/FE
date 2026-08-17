import type { DiagnosisDraft, DiagnosisForm } from "../app/types.js";
import type { TpoCode } from "../data/options.js";

/**
 * 진단 입력이 다 찼는지 판정한다.
 *
 * 화면마다 조건을 따로 쓰면 한쪽만 고쳐져 빈 값이 저장으로 새어 나간다.
 * 그래서 **단계별 버튼 활성 조건과 저장 직전 검사를 같은 파일에서** 만든다.
 * 화면은 `~StepReady`로 다음 버튼을 막고, 계산·저장은 `completeForm()`이 돌려준
 * 완성본만 쓴다.
 */

/** 화면 입력칸의 min/max와 같은 값이다 (DiagnosisScreens U3-1). */
export const HEIGHT_MIN = 130;
export const HEIGHT_MAX = 200;

export function bodyStepReady(draft: DiagnosisDraft) {
  return (
    draft.height !== undefined &&
    draft.height >= HEIGHT_MIN &&
    draft.height <= HEIGHT_MAX &&
    Boolean(draft.topSize) &&
    Boolean(draft.bottomSize) &&
    Boolean(draft.bodyType)
  );
}

/** 핏 고민은 최대 2개까지 고를 수 있고, 최소 1개는 있어야 한다. */
export function fitStepReady(draft: DiagnosisDraft) {
  return draft.fitConcerns.length > 0;
}

export function styleStepReady(draft: DiagnosisDraft) {
  return (
    Boolean(draft.preferredStyle) &&
    Boolean(draft.avoidedStyle) &&
    draft.keywords.length === 3
  );
}

export function designStepReady(draft: DiagnosisDraft) {
  return draft.designElements.length === 3;
}

export function itemStepReady(draft: DiagnosisDraft) {
  return draft.preferredItems.length === 3;
}

/**
 * 그룹 진단의 TPO는 구성원별이 아니라 약속 하나라 `state.group.tpo`를 넘겨 받는다.
 * 개인 진단은 넘기지 않으면 draft의 값을 쓴다.
 */
export function budgetStepReady(draft: DiagnosisDraft, tpo = draft.tpo) {
  return (
    draft.budgetMinCode !== undefined &&
    draft.budgetMaxCode !== undefined &&
    Boolean(draft.budgetApproach) &&
    Boolean(tpo)
  );
}

/**
 * 다 채워졌으면 완성본을, 하나라도 비었으면 `null`을 돌려준다.
 * 게이팅이 앞을 막으므로 평소에는 `null`이 나오지 않는다 —
 * 세션 저장값이 사라졌을 때처럼 화면을 건너뛴 경우를 잡는 마지막 그물이다.
 */
export function completeForm(
  draft: DiagnosisDraft,
  tpo: TpoCode | undefined = draft.tpo,
): DiagnosisForm | null {
  if (!bodyStepReady(draft) || !fitStepReady(draft)) return null;
  if (!styleStepReady(draft) || !designStepReady(draft) || !itemStepReady(draft)) return null;
  if (!budgetStepReady(draft, tpo)) return null;

  const {
    height,
    topSize,
    bottomSize,
    bodyType,
    preferredStyle,
    avoidedStyle,
    budgetMinCode,
    budgetMaxCode,
    budgetApproach,
  } = draft;
  // 위 검사를 통과하면 아래 값은 모두 있다. 타입을 좁히려고 한 번 더 확인한다.
  if (
    height === undefined ||
    topSize === undefined ||
    bottomSize === undefined ||
    bodyType === undefined ||
    preferredStyle === undefined ||
    avoidedStyle === undefined ||
    budgetMinCode === undefined ||
    budgetMaxCode === undefined ||
    budgetApproach === undefined ||
    tpo === undefined
  ) {
    return null;
  }

  return {
    height,
    topSize,
    bottomSize,
    bodyType,
    fitConcerns: draft.fitConcerns,
    fitNote: draft.fitNote,
    preferredStyle,
    avoidedStyle,
    keywords: draft.keywords,
    designElements: draft.designElements,
    preferredItems: draft.preferredItems,
    avoidedElements: draft.avoidedElements,
    // 표시용 대표값. 슬라이더가 min·max만 주므로 여기서 가운데 값을 만든다.
    budgetCode: draft.budgetCode ?? Math.round((budgetMinCode + budgetMaxCode) / 2),
    budgetMinCode,
    budgetMaxCode,
    budgetApproach,
    tpo,
  };
}
