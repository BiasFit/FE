import type {
  AiRequestStatus,
  BudgetRange,
  DiagnosisForm,
  MatchPriority,
  MemberId,
  PriorityOption,
} from "./types";
import type { TpoCode } from "../data/options";
import type {
  MatchExplanation,
  StyleDnaExplanationResponse,
} from "../domain/aiContracts";
import type { RankedInfluencer } from "../domain/scoring";
import { personaForms } from "../data/personas";

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
  /** 저장된 test_results 행의 id. 인플루언서 화면이 이 결과를 조회할 때 쓴다. */
  savedResultId: string;
  personal: DiagnosisForm;
  group: {
    relationship: "friend" | "family" | "other";
    relationshipOther: string;
    tpo: TpoCode;
    members: Record<MemberId, DiagnosisForm>;
  };
  selectedInfluencerId: string;
  selectedInfluencerScore: number;
  activeRequestId: string;
  requestText: Record<"personal" | "group", string>;
  requestBudget: {
    personal: BudgetRange;
    group: Record<MemberId, BudgetRange>;
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
  | { type: "selectMatchPriority"; priority: MatchPriority }
  | { type: "updatePersonal"; patch: Partial<DiagnosisForm> }
  | {
      type: "updateGroupMember";
      member: MemberId;
      patch: Partial<DiagnosisForm>;
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

const copyForm = (form: DiagnosisForm): DiagnosisForm => ({
  ...form,
  fitConcerns: [...form.fitConcerns],
  keywords: [...form.keywords],
  designElements: [...form.designElements],
  preferredItems: [...form.preferredItems],
  avoidedElements: [...form.avoidedElements],
});

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
    personal: copyForm(personaForms.P1),
    group: {
      relationship: "friend",
      relationshipOther: "",
      tpo: "travel",
      members: {
        A: copyForm(personaForms.P4),
        B: copyForm(personaForms.P5),
      },
    },
    selectedInfluencerId: "",
    selectedInfluencerScore: 0,
    activeRequestId: "",
    requestText: { personal: "", group: "" },
    requestBudget: {
      personal: {
        minCode: personaForms.P1.budgetMinCode,
        maxCode: personaForms.P1.budgetMaxCode,
      },
      group: {
        A: {
          minCode: personaForms.P4.budgetMinCode,
          maxCode: personaForms.P4.budgetMaxCode,
        },
        B: {
          minCode: personaForms.P5.budgetMinCode,
          maxCode: personaForms.P5.budgetMaxCode,
        },
      },
    },
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
          personal: {
            minCode: state.personal.budgetMinCode,
            maxCode: state.personal.budgetMaxCode,
          },
          group: {
            A: {
              minCode: state.group.members.A.budgetMinCode,
              maxCode: state.group.members.A.budgetMaxCode,
            },
            B: {
              minCode: state.group.members.B.budgetMinCode,
              maxCode: state.group.members.B.budgetMaxCode,
            },
          },
        },
      };
    default:
      return state;
  }
}
