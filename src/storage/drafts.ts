import type { GroupOutfitDraft, PersonalOutfitDraft } from "../app/types.js";

export type OutfitDraft = PersonalOutfitDraft | GroupOutfitDraft;

// v2 stores structured top/bottom products with URLs; v1 string drafts are incompatible.
const DRAFT_PREFIX = "biasfit:outfit-draft:v2";

export function draftStorageKey(influencerId: string, requestId: string) {
  return `${DRAFT_PREFIX}:${influencerId}:${requestId}`;
}

export function saveDraft(
  influencerId: string,
  requestId: string,
  draft: OutfitDraft,
) {
  localStorage.setItem(
    draftStorageKey(influencerId, requestId),
    JSON.stringify(draft),
  );
}

export function loadDraft(
  influencerId: string,
  requestId: string,
): OutfitDraft | null {
  const serialized = localStorage.getItem(
    draftStorageKey(influencerId, requestId),
  );
  if (!serialized) return null;
  try {
    return JSON.parse(serialized) as OutfitDraft;
  } catch {
    return null;
  }
}

export function clearDraft(influencerId: string, requestId: string) {
  localStorage.removeItem(draftStorageKey(influencerId, requestId));
}
