import type {
  AiRequestStatus,
  BudgetRange,
  DiagnosisDraft,
  MatchPriority,
  MemberId,
  PriorityOption,
} from "./types.js";
import type { TpoCode } from "../data/options.js";
import type {
  MatchExplanation,
  StyleDnaExplanationResponse,
} from "../domain/aiContracts.js";
import type { RankedInfluencer } from "../domain/scoring.js";
import type { StylemateView } from "../data/influencers.js";

export interface AppState {
  mode: "personal" | "group";
  activeMember: MemberId;
  matchPriority: MatchPriority | null;
  priorityOptions: PriorityOption[];
  priorityStatus: AiRequestStatus;
  /** AI2 결과. 화면에 쓴 객체를 그대로 저장에 재사용한다. */
  styleDna: StyleDnaExplanationResponse | null;
  styleDnaStatus: AiRequestStatus;
  /** 규칙 엔진이 계산한 TOP 3. 저장 시점에 다시 계산하지 않는다. */
  rankedInfluencers: RankedInfluencer[];
  rankStatus: AiRequestStatus;
  /** AI4 추천 근거. */
  matchExplanations: MatchExplanation[];
  matchExplanationStatus: AiRequestStatus;
  /** 저장된 `match_results.id`. 부탁해요 카드와 코디 카드가 이 id로 붙는다. */
  savedResultId: string;
  /**
   * DB에서 읽은 스타일메이트 목록. 카드의 소개·가격대·강점 TPO 표시에 쓴다.
   * 하드코딩 배열을 대체한다.
   */
  influencerDirectory: StylemateView[];
  personal: DiagnosisDraft;
  group: {
    relationship: "friend" | "family" | "other";
    relationshipOther: string;
    /** 그룹은 TPO가 구성원별이 아니라 약속 하나다. 고르기 전에는 값이 없다. */
    tpo?: TpoCode;
    members: Record<MemberId, DiagnosisDraft>;
  };
  selectedInfluencerId: string;
  selectedInfluencerScore: number;
  activeRequestId: string;
  requestText: Record<"personal" | "group", string>;
  /** 부탁해요 카드를 보낸 시점의 예산. 아직 안 보냈으면 없다. */
  requestBudget: {
    personal: BudgetRange | null;
    group: Record<MemberId, BudgetRange | null>;
  };
}

export type AppAction =
  | { type: "setMode"; mode: AppState["mode"] }
  | { type: "setActiveMember"; member: MemberId }
  | { type: "setPriorityLoading" }
  | { type: "setPriorityOptions"; options: PriorityOption[] }
  | { type: "setPriorityError" }
  | { type: "setStyleDnaLoading" }
  | { type: "setStyleDna"; result: StyleDnaExplanationResponse }
  | { type: "setStyleDnaError" }
  | { type: "setRankingLoading" }
  | { type: "setRankedInfluencers"; ranked: RankedInfluencer[] }
  | { type: "setRankingError" }
  | { type: "setMatchExplanationsLoading" }
  | { type: "setMatchExplanations"; explanations: MatchExplanation[] }
  | { type: "setMatchExplanationsError" }
  | { type: "setSavedResultId"; id: string }
  | { type: "setInfluencerDirectory"; influencers: StylemateView[] }
  | { type: "selectMatchPriority"; priority: MatchPriority }
  | { type: "updatePersonal"; patch: Partial<DiagnosisDraft> }
  | {
      type: "updateGroupMember";
      member: MemberId;
      patch: Partial<DiagnosisDraft>;
    }
  | {
      type: "updateGroup";
      patch: Partial<Omit<AppState["group"], "members">>;
    }
  | { type: "selectInfluencer"; influencerId: string; score?: number }
  | { type: "selectRequest"; requestId: string }
  | {
      type: "updateRequest";
      mode: AppState["mode"];
      value: string;
    }
  | { type: "submitRequest" };

/**
 * 아무것도 고르지 않은 진단 입력.
 *
 * 예전에는 P1·P4·P5 페르소나 값을 복사해 넣었다. 화면이 처음부터 다 채워져 보여
 * 사용자가 한 번도 만지지 않은 항목이 그 사람의 답으로 저장됐다.
 * 배열만 빈 배열로 두고, 단일 선택 항목은 값 자체를 두지 않는다.
 */
const emptyDraft = (): DiagnosisDraft => ({
  fitConcerns: [],
  fitNote: "",
  keywords: [],
  designElements: [],
  preferredItems: [],
  avoidedElements: [],
});

/** 예산을 아직 안 고른 진단은 범위를 만들지 않는다. 0으로 채우면 고른 것처럼 보인다. */
const budgetRangeOf = (draft: DiagnosisDraft): BudgetRange | null =>
  draft.budgetMinCode === undefined || draft.budgetMaxCode === undefined
    ? null
    : { minCode: draft.budgetMinCode, maxCode: draft.budgetMaxCode };

export function createInitialState(): AppState {
  return {
    mode: "personal",
    activeMember: "A",
    matchPriority: null,
    priorityOptions: [],
    priorityStatus: "idle",
    styleDna: null,
    styleDnaStatus: "idle",
    rankedInfluencers: [],
    rankStatus: "idle",
    matchExplanations: [],
    matchExplanationStatus: "idle",
    savedResultId: "",
    influencerDirectory: [],
    personal: emptyDraft(),
    group: {
      relationship: "friend",
      relationshipOther: "",
      members: {
        A: emptyDraft(),
        B: emptyDraft(),
      },
    },
    selectedInfluencerId: "",
    selectedInfluencerScore: 0,
    activeRequestId: "",
    requestText: { personal: "", group: "" },
    requestBudget: { personal: null, group: { A: null, B: null } },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  const invalidatePriority = {
    matchPriority: null,
    priorityOptions: [],
    priorityStatus: "idle" as const,
  };
  // 입력이 바뀌면 옛 AI 결과가 남아 잘못 저장되지 않게 함께 비운다.
  const invalidateStyleDna = {
    styleDna: null,
    styleDnaStatus: "idle" as const,
  };
  const invalidateRanking = {
    rankedInfluencers: [],
    rankStatus: "idle" as const,
    matchExplanations: [],
    matchExplanationStatus: "idle" as const,
    // 저장된 id는 옛 스냅샷을 가리킨다. 입력이 바뀌면 함께 버린다.
    savedResultId: "",
  };
  const invalidateSelectedInfluencer = {
    selectedInfluencerId: "",
    selectedInfluencerScore: 0,
  };
  switch (action.type) {
    case "setMode":
      return {
        ...state,
        mode: action.mode,
        ...invalidatePriority,
        ...invalidateStyleDna,
        ...invalidateRanking,
        ...invalidateSelectedInfluencer,
      };
    case "setActiveMember":
      return { ...state, activeMember: action.member };
    case "setPriorityLoading":
      return { ...state, priorityStatus: "loading", priorityOptions: [] };
    case "setPriorityOptions":
      return {
        ...state,
        priorityStatus: "success",
        priorityOptions: action.options,
      };
    case "setPriorityError":
      return { ...state, priorityStatus: "error", priorityOptions: [] };
    case "setStyleDnaLoading":
      return { ...state, styleDnaStatus: "loading", styleDna: null };
    case "setStyleDna":
      return { ...state, styleDnaStatus: "success", styleDna: action.result };
    case "setStyleDnaError":
      return { ...state, styleDnaStatus: "error", styleDna: null };
    case "setRankingLoading":
      // 순위가 바뀌면 그 순위에 붙은 추천 근거도 무효다.
      return { ...state, ...invalidateRanking, rankStatus: "loading" };
    case "setRankedInfluencers":
      return { ...state, rankStatus: "success", rankedInfluencers: action.ranked };
    case "setRankingError":
      return { ...state, rankStatus: "error", rankedInfluencers: [] };
    case "setMatchExplanationsLoading":
      return {
        ...state,
        matchExplanationStatus: "loading",
        matchExplanations: [],
      };
    case "setMatchExplanations":
      return {
        ...state,
        matchExplanationStatus: "success",
        matchExplanations: action.explanations,
      };
    case "setMatchExplanationsError":
      return {
        ...state,
        matchExplanationStatus: "error",
        matchExplanations: [],
      };
    case "setSavedResultId":
      return { ...state, savedResultId: action.id };
    case "setInfluencerDirectory":
      // 진단 입력과 무관한 참조 데이터라 무효화 대상이 아니다.
      return { ...state, influencerDirectory: action.influencers };
    case "selectMatchPriority":
      // 우선순위는 Style DNA와 TOP 3 계산에 모두 들어간다. 바뀌면 둘 다 다시 받아야 한다.
      return {
        ...state,
        matchPriority: action.priority,
        ...invalidateStyleDna,
        ...invalidateRanking,
        ...invalidateSelectedInfluencer,
      };
    case "updatePersonal":
      return {
        ...state,
        personal: { ...state.personal, ...action.patch },
        ...invalidatePriority,
        ...invalidateStyleDna,
        ...invalidateRanking,
        ...invalidateSelectedInfluencer,
      };
    case "updateGroupMember":
      return {
        ...state,
        group: {
          ...state.group,
          members: {
            ...state.group.members,
            [action.member]: {
              ...state.group.members[action.member],
              ...action.patch,
            },
          },
        },
        ...invalidatePriority,
        ...invalidateStyleDna,
        ...invalidateRanking,
        ...invalidateSelectedInfluencer,
      };
    case "updateGroup":
      return {
        ...state,
        group: { ...state.group, ...action.patch },
        ...invalidatePriority,
        ...invalidateStyleDna,
        ...invalidateRanking,
        ...invalidateSelectedInfluencer,
      };
    case "selectInfluencer":
      return {
        ...state,
        selectedInfluencerId: action.influencerId,
        selectedInfluencerScore:
          action.score ?? state.selectedInfluencerScore,
      };
    case "selectRequest":
      return { ...state, activeRequestId: action.requestId };
    case "updateRequest":
      return {
        ...state,
        requestText: { ...state.requestText, [action.mode]: action.value },
      };
    case "submitRequest":
      return {
        ...state,
        activeRequestId:
          state.mode === "group"
            ? "LOCAL-GROUP-REQUEST"
            : "LOCAL-PERSONAL-REQUEST",
        requestBudget: {
          personal: budgetRangeOf(state.personal),
          group: {
            A: budgetRangeOf(state.group.members.A),
            B: budgetRangeOf(state.group.members.B),
          },
        },
      };
    default:
      return state;
  }
}
