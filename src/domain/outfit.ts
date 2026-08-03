import type { GroupOutfitDraft, OutfitFields, PersonalOutfitDraft } from "../app/types";

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
