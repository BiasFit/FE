import type { StyleName, StyleScores } from "../domain/scoring";

export type CoachingMode = "personal" | "group";
export type MemberId = "A" | "B";
export type AccountRole = "user" | "influencer";

export interface SignupForm {
  loginId: string;
  displayName: string;
  password: string;
  passwordConfirm: string;
  birthDate: string;
  profileImageName: string;
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
    | "가성비 중심"
    | "균형형"
    | "품질·소재 우선"
    | "투자 아이템 중심";
  tpo: string;
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
  message: string;
}

export interface GroupOutfitDraft {
  memberA: OutfitFields;
  memberB: OutfitFields;
  message: string;
}
