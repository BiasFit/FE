import { isMatchPriority } from "../../src/domain/aiContracts";
import {
  rankInfluencers,
  type InfluencerProfile,
  type RankMatchInput,
} from "../../src/domain/scoring";
import { loadInfluencerProfiles } from "../_lib/influencerProfiles";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/**
 * 후보 모집단은 DB에서 읽는다. 하드코딩 배열로 폴백하지 않는다 —
 * 폴백하면 시드가 없거나 어휘가 어긋나도 그럴듯한 결과가 나와 문제를 덮는다.
 */
export function calculateTopThree(input: RankMatchInput, profiles: InfluencerProfile[]) {
  if (
    (input.mode !== "personal" && input.mode !== "group") ||
    !isMatchPriority(input.priority)
  ) {
    throw new Error("TOP 3 계산 입력이 올바르지 않습니다.");
  }
  return rankInfluencers(input, profiles);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const input = readJsonBody(request) as RankMatchInput;
    const profiles = await loadInfluencerProfiles();
    response.status(200).json({
      rankedInfluencers: calculateTopThree(input, profiles),
    });
  } catch (error) {
    console.error("[BiasFit 매칭] top-three failed", error);
    sendApiError(response, error);
  }
}
