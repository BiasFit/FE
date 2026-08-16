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

export interface DiagnosisForm {
  personaId: "P1" | "P2" | "P3" | "P4" | "P5";
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

export interface StyleDna {
  personaId: DiagnosisForm["personaId"];
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
