import type { DiagnosisForm, MatchPriority, PriorityOption } from "../app/types";
import type { TpoCode } from "../data/options";
import type {
  MatchExplanation,
  StyleDnaExplanationResponse,
} from "./aiContracts";
import type { CategoryScores } from "./matchPriority";
import type { MatchBreakdown, StyleScoreBreakdown, StyleScores } from "./scoring";

/**
 * 한 번의 진단 흐름을 그대로 남기는 스냅샷.
 * 화면에 쓴 값을 그대로 담는다. 저장을 위해 점수를 다시 계산하거나 OpenAI를 다시 부르지 않는다.
 * 열람할 때도 재계산하지 않는다 (DB_SCHEMA.md 2.1, STYLE_SCORING_DRAFT.md 7.7).
 */
export interface TestResultPayload {
  mode: "personal" | "group";
  priority: MatchPriority;
  /** 개인은 form.tpo, 그룹은 group.tpo. 반드시 내부 코드를 넣는다. */
  tpo: TpoCode;
  /** 같은 브라우저의 회차를 묶는 익명 키. test_results.anon_user_key가 not null이다. */
  anonUserKey: string;

  input: {
    /** 개인은 길이 1, 그룹은 2. 화면에서 쓴 값 그대로. */
    members: Array<{ memberId: "self" | "A" | "B"; form: DiagnosisForm }>;
    group?: { relationship: string; relationshipOther: string };
  };

  ai: {
    priorityOptions: PriorityOption[];
    styleDna: StyleDnaExplanationResponse;
    matchExplanations: MatchExplanation[];
  };

  score: {
    /**
     * 스타일별 총점과 항목별 내역.
     * 내역은 `style_score_breakdowns`에 그대로 들어간다 (DB_SCHEMA.md 5.14).
     * 저장 시점에 다시 계산하지 않으려고 화면에서 만든 값을 함께 싣는다.
     */
    styleScores: Array<{
      memberId: string;
      scores: StyleScores;
      breakdowns: Record<string, StyleScoreBreakdown[]>;
    }>;
    groupCompatibility?: {
      styleSimilarity: number;
      budgetCompatibility: number;
      total: number;
    };
    /**
     * InfluencerProfile 전체를 담지 않는다. 인플루언서 프로필은 별도 데이터이고,
     * 스냅샷에는 식별자와 점수만 있으면 충분하다. matchedEvidence는 내부 검증용이라 제외한다.
     */
    rankedInfluencers: Array<{
      rank: number;
      influencerId: string;
      influencerName: string;
      baseBreakdown: CategoryScores;
      breakdown: MatchBreakdown;
    }>;
  };
}

export interface SavedTestResult {
  id: string;
}
