import type { GroupOutfitDraft, OutfitFields, PersonalOutfitDraft } from "../app/types";
import type { OutfitReviewRequest } from "./aiContracts";

export function isValidProductUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidOutfitFields(fields: OutfitFields) {
  return ([fields.top, fields.bottom] as const).every(
    (product) => product.name.trim().length > 0 && isValidProductUrl(product.url),
  );
}

export function isValidOutfitDraft(draft: PersonalOutfitDraft | GroupOutfitDraft) {
  if ("memberA" in draft) {
    return isValidOutfitFields(draft.memberA) && isValidOutfitFields(draft.memberB);
  }
  return isValidOutfitFields(draft);
}

export function toOutfitReviewRequest(
  draft: PersonalOutfitDraft | GroupOutfitDraft,
): OutfitReviewRequest {
  if ("memberA" in draft) {
    return {
      mode: "group",
      coachingMessage: draft.message,
      cards: [
        { memberId: "A", ...draft.memberA },
        { memberId: "B", ...draft.memberB },
      ],
    };
  }
  return {
    mode: "personal",
    coachingMessage: draft.message,
    cards: [{ memberId: "self", top: draft.top, bottom: draft.bottom }],
  };
}
