import type { DiagnosisForm, MemberId } from "./types";
import { personaForms, requestCopy } from "../data/personas";

export interface AppState {
  mode: "personal" | "group";
  activeMember: MemberId;
  personal: DiagnosisForm;
  group: {
    relationship: "friend" | "family" | "other";
    relationshipOther: string;
    tpo: string;
    members: Record<MemberId, DiagnosisForm>;
  };
  selectedInfluencerId: string;
  selectedInfluencerScore: number;
  activeRequestId: string;
  requestText: Record<"personal" | "group", string>;
}

export type AppAction =
  | { type: "setMode"; mode: AppState["mode"] }
  | { type: "setActiveMember"; member: MemberId }
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
    };

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
    personal: copyForm(personaForms.P1),
    group: {
      relationship: "friend",
      relationshipOther: "",
      tpo: "여행·사진",
      members: {
        A: copyForm(personaForms.P4),
        B: copyForm(personaForms.P5),
      },
    },
    selectedInfluencerId: "stylemate-01",
    selectedInfluencerScore: 89,
    activeRequestId: "P1-2026-001",
    requestText: { ...requestCopy },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode };
    case "setActiveMember":
      return { ...state, activeMember: action.member };
    case "updatePersonal":
      return { ...state, personal: { ...state.personal, ...action.patch } };
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
      };
    case "updateGroup":
      return { ...state, group: { ...state.group, ...action.patch } };
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
    default:
      return state;
  }
}
