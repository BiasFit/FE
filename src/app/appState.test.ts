import { describe, expect, it } from "vitest";
import { appReducer, createInitialState } from "./appState.js";

describe("appReducer", () => {
  it("starts without a preselected stylemate score", () => {
    const initial = createInitialState();

    expect(initial.selectedInfluencerId).toBe("");
    expect(initial.selectedInfluencerScore).toBe(0);
  });

  it("clears a selected stylemate when diagnosis input changes", () => {
    const selected = appReducer(createInitialState(), {
      type: "selectInfluencer",
      influencerId: "stylemate-02",
      score: 57,
    });
    const updated = appReducer(selected, {
      type: "updatePersonal",
      patch: { height: 168 },
    });

    expect(updated.selectedInfluencerId).toBe("");
    expect(updated.selectedInfluencerScore).toBe(0);
  });

  it("keeps group member inputs independent", () => {
    const initial = createInitialState();
    const updated = appReducer(initial, {
      type: "updateGroupMember",
      member: "A",
      patch: { height: 160, preferredStyle: "로맨틱" },
    });

    expect(updated.group.members.A.height).toBe(160);
    expect(updated.group.members.B.height).toBe(165);
    expect(updated.group.members.B.preferredStyle).toBe(
      "오피스 & 비즈니스캐주얼",
    );
  });

  it("updates the selected stylemate without mutating diagnosis inputs", () => {
    const initial = createInitialState();
    const updated = appReducer(initial, {
      type: "selectInfluencer",
      influencerId: "stylemate-02",
    });

    expect(updated.selectedInfluencerId).toBe("stylemate-02");
    expect(updated.personal.height).toBe(158);
    expect(initial.selectedInfluencerId).toBe("");
  });

  it("keeps the selected assigned request in app state", () => {
    const initial = createInitialState();
    const updated = appReducer(initial, {
      type: "selectRequest",
      requestId: "G1-2026-004",
    });

    expect(updated.activeRequestId).toBe("G1-2026-004");
    expect(updated.personal).toEqual(initial.personal);
  });

  it("captures the current budget range when a request is sent", () => {
    const initial = createInitialState();
    const changed = appReducer(initial, {
      type: "updatePersonal",
      patch: { budgetMinCode: 2, budgetMaxCode: 4 },
    });
    const submitted = appReducer(changed, { type: "submitRequest" });

    expect(submitted.requestBudget.personal).toEqual({
      minCode: 2,
      maxCode: 4,
    });
    expect(submitted.activeRequestId).toBe("LOCAL-PERSONAL-REQUEST");
  });
});
