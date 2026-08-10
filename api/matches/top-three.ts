import { influencers } from "../../src/data/influencers";
import { isMatchPriority } from "../../src/domain/aiContracts";
import {
  rankInfluencers,
  type RankMatchInput,
} from "../../src/domain/scoring";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

export function calculateTopThree(input: RankMatchInput) {
  if (
    (input.mode !== "personal" && input.mode !== "group") ||
    !isMatchPriority(input.priority)
  ) {
    throw new Error("TOP 3 계산 입력이 올바르지 않습니다.");
  }
  return rankInfluencers(input, influencers);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json({
      rankedInfluencers: calculateTopThree(
        readJsonBody(request) as RankMatchInput,
      ),
    });
  } catch (error) {
    sendApiError(response, error);
  }
}
