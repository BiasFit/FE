import type {
  AiRequestStatus,
  BudgetRange,
  DiagnosisForm,
  MatchPriority,
  MemberId,
  PriorityOption,
} from "./types";
import type { TpoCode } from "../data/options";
import { personaForms } from "../data/personas";

export interface AppState {
  mode: "personal" | "group";
  activeMember: MemberId;
  matchPriority: MatchPriority | null;
  priorityOptions: PriorityOption[];
  priorityStatus: AiRequestStatus;
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
  const invalidateSelectedInfluencer = {
    selectedInfluencerId: "",
    selectedInfluencerScore: 0,
  };
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode, ...invalidatePriority, ...invalidateSelectedInfluencer };
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
    case "selectMatchPriority":
      return { ...state, matchPriority: action.priority, ...invalidateSelectedInfluencer };
    case "updatePersonal":
      return {
        ...state,
        personal: { ...state.personal, ...action.patch },
        ...invalidatePriority,
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
        ...invalidateSelectedInfluencer,
      };
    case "updateGroup":
      return {
        ...state,
        group: { ...state.group, ...action.patch },
        ...invalidatePriority,
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
