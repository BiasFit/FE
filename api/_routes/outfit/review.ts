import type {
  LinkCheck,
  OutfitReviewRequest,
  OutfitReviewResponse,
  SafeLanguageIssue,
} from "../../../src/domain/aiContracts.js";
import { checkProductLinks } from "../../_lib/link-checker.js";
import { reviewSafeLanguage } from "../../_lib/safe-language.js";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

interface ReviewDependencies {
  reviewLanguage(message: string): Promise<{ issues: SafeLanguageIssue[] }>;
  checkLinks(cards: OutfitReviewRequest["cards"]): Promise<LinkCheck[]>;
}

export async function reviewOutfitCard(
  input: OutfitReviewRequest,
  dependencies: ReviewDependencies = {
    reviewLanguage: reviewSafeLanguage,
    checkLinks: checkProductLinks,
  },
): Promise<OutfitReviewResponse> {
  const expectedCards = input.mode === "personal" ? 1 : 2;
  if (input.cards.length !== expectedCards || !input.coachingMessage.trim()) {
    throw new Error("코디 카드 검수 입력이 올바르지 않습니다.");
  }
  const [languageReview, linkChecks] = await Promise.all([
    dependencies.reviewLanguage(input.coachingMessage),
    dependencies.checkLinks(input.cards),
  ]);
  const reviewStatus = linkChecks.some((link) => link.status === "failed")
    ? "blocked"
    : languageReview.issues.length > 0 ||
        linkChecks.some((link) => link.status === "needs_revision")
      ? "needs_revision"
      : linkChecks.some((link) => link.status === "operations_review")
        ? "operations_review"
        : "pass";
  return {
    reviewStatus,
    safeLanguageIssues: languageReview.issues,
    linkChecks,
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json(
      await reviewOutfitCard(readJsonBody(request) as OutfitReviewRequest),
    );
  } catch (error) {
    sendApiError(response, error);
  }
}
