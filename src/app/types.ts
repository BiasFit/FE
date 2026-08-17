import type { TpoCode } from "../data/options.js";
import type { StyleName, StyleScores } from "../domain/scoring.js";

export type CoachingMode = "personal" | "group";
export type MemberId = "A" | "B";
export type AccountRole = "user" | "influencer";
export type MatchPriority =
  | "style_first"
  | "fit_first"
  | "budget_first"
  | "tpo_first";
export type AiRequestStatus = "idle" | "loading" | "success" | "error";

export interface PriorityOption {
  code: MatchPriority;
  label: string;
  evidenceRefs: string[];
}

export interface SignupForm {
  loginId: string;
  displayName: string;
  password: string;
  passwordConfirm: string;
  birthDate: string;
  /** 인플루언서 전용 선택 입력. 피그마 A4에는 있지만, 서버 가입 API는 아직 이 값을 받지 않는다
   * (생년월일과 같은 처리 — 화면에 남기되 signUp() 호출에는 넣지 않는다). */
  snsAccount: string;
}

/**
 * 진단 입력 **완성본**. 점수 계산·AI 요청·저장은 모두 이 모양만 받는다.
 * 화면이 들고 다니는 작성 중 값은 `DiagnosisDraft`다.
 */
export interface DiagnosisForm {
  height: number;
  topSize: string;
  bottomSize: string;
  bodyType: "스트레이트" | "웨이브" | "내추럴";
  fitConcerns: string[];
  fitNote: string;
  preferredStyle: StyleName;
  avoidedStyle: StyleName;
  keywords: string[];
  designElements: string[];
  preferredItems: string[];
  avoidedElements: string[];
  budgetCode: number;
  budgetMinCode: number;
  budgetMaxCode: number;
  budgetApproach:
    | "총액 절약형"
    | "일상 활용형"
    | "소재·품질 우선형"
    | "포인트 아이템 투자형";
  /** 내부 코드. 화면 표시는 tpoLabel()을 거친다. */
  tpo: TpoCode;
}

/**
 * 작성 중인 진단 입력. 아직 고르지 않은 항목은 **값이 없다**(`undefined`).
 *
 * 빈 문자열이나 0 같은 대체값을 넣지 않는다 — 그런 값은 사용자가 직접 고른 것과
 * 구분되지 않아 그대로 저장돼 버린다. 예전에는 P1 페르소나 값을 미리 채워 두는 바람에
 * 아무것도 안 고른 사람의 진단 결과가 P1의 몸·취향으로 남았다.
 * 완성 여부 판정은 `src/domain/diagnosisComplete.ts` 한 곳에서만 한다.
 */
export type DiagnosisDraft = Partial<DiagnosisForm> &
  Pick<
    DiagnosisForm,
    | "fitConcerns"
    | "fitNote"
    | "keywords"
    | "designElements"
    | "preferredItems"
    | "avoidedElements"
  >;

export interface StyleDna {
  scores: StyleScores;
  summary: string;
}

export interface BudgetRange {
  minCode: number;
  maxCode: number;
}

export interface ProductItem {
  name: string;
  url: string;
}

export interface OutfitFields {
  top: ProductItem;
  bottom: ProductItem;
}

export interface PersonalOutfitDraft extends OutfitFields {
  /** `outfit_cards.title`. 사용자 화면 카드의 제목이 된다. */
  title: string;
  message: string;
}

export interface GroupOutfitDraft {
  memberA: OutfitFields;
  memberB: OutfitFields;
  title: string;
  message: string;
}
