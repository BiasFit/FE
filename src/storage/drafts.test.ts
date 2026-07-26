import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDraft,
  draftStorageKey,
  loadDraft,
  saveDraft,
} from "./drafts";

describe("outfit draft storage", () => {
  beforeEach(() => localStorage.clear());

  it("scopes a draft to influencer and request identifiers", () => {
    expect(draftStorageKey("stylemate-01", "P1-2026-001")).toBe(
      "biasfit:outfit-draft:v1:stylemate-01:P1-2026-001",
    );
  });

  it("saves, restores and clears a scoped draft", () => {
    const draft = {
      top: "소프트 핑크 가디건",
      bottom: "아이보리 A라인 스커트",
      shoes: "화이트 메리제인",
      message: "편안하게 선택할 수 있는 조합이에요.",
    };

    saveDraft("stylemate-01", "P1-2026-001", draft);
    expect(loadDraft("stylemate-01", "P1-2026-001")).toEqual(draft);
    expect(loadDraft("stylemate-02", "P1-2026-001")).toBeNull();

    clearDraft("stylemate-01", "P1-2026-001");
    expect(loadDraft("stylemate-01", "P1-2026-001")).toBeNull();
  });
});
