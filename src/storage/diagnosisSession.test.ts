import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "../app/appState.js";
import { clearAppState, loadAppState, saveAppState } from "./diagnosisSession.js";

const KEY = "biasfit:app-state:v1";

/**
 * 저장된 값이 망가지면 화면이 첫 렌더에서 죽는다(`ranked.map is not a function`).
 * 그 값은 sessionStorage에 남으므로 새로고침해도 계속 죽는다 — 사용자는 빠져나올 수 없다.
 * 키가 있는지만 보던 예전 검사는 그걸 잡지 못했다.
 */
describe("loadAppState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("저장된 값이 없으면 초기 상태를 준다", () => {
    expect(loadAppState().matchPriority).toBeNull();
  });

  it("정상 저장값은 그대로 이어받는다", () => {
    const state = { ...createInitialState(), matchPriority: "style_first" as const };
    saveAppState(state);
    expect(loadAppState().matchPriority).toBe("style_first");
  });

  it.each([
    ["rankedInfluencers", "손상된 값"],
    ["rankedInfluencers", null],
    ["matchExplanations", 3],
    ["priorityOptions", {}],
    ["influencerDirectory", "x"],
    ["personal", null],
    ["group", "x"],
  ])("%s의 모양이 어긋나면 초기 상태로 되돌린다 (%o)", (field, broken) => {
    const state = { ...createInitialState(), matchPriority: "style_first" as const };
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, [field]: broken }));
    // 초기 상태로 떨어졌는지는 저장해 둔 우선순위가 사라진 것으로 확인한다.
    expect(loadAppState().matchPriority).toBeNull();
    expect(Array.isArray(loadAppState().rankedInfluencers)).toBe(true);
  });

  it("group.members가 사라지면 초기 상태로 되돌린다", () => {
    const state = { ...createInitialState(), matchPriority: "style_first" as const };
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...state, group: { ...state.group, members: null } }),
    );
    expect(loadAppState().matchPriority).toBeNull();
  });

  it("JSON이 아니면 초기 상태로 되돌린다", () => {
    sessionStorage.setItem(KEY, "{망가진 값");
    expect(loadAppState().matchPriority).toBeNull();
  });

  it("옛 구조(키 누락)는 받아들이지 않는다", () => {
    const { personal: _dropped, ...withoutPersonal } = createInitialState();
    sessionStorage.setItem(KEY, JSON.stringify(withoutPersonal));
    expect(loadAppState().personal).toBeDefined();
  });
});

describe("clearAppState", () => {
  it("저장된 진단을 지운다", () => {
    saveAppState({ ...createInitialState(), matchPriority: "fit_first" as const });
    clearAppState();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(loadAppState().matchPriority).toBeNull();
  });
});
