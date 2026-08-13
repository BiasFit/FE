import { isMatchPriority } from "../../../src/domain/aiContracts";
import {
  filterEligibleInfluencers,
  rankInfluencers,
  type InfluencerProfile,
  type RankMatchInput,
} from "../../../src/domain/scoring";
import {
  loadInfluencerProfiles,
  loadReceivedRequestCounts,
} from "../../_lib/influencerProfiles";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http";

/**
 * 후보 모집단은 DB에서 읽는다. 하드코딩 배열로 폴백하지 않는다 —
 * 폴백하면 시드가 없거나 어휘가 어긋나도 그럴듯한 결과가 나와 문제를 덮는다.
 */
export function calculateTopThree(
  input: RankMatchInput,
  profiles: InfluencerProfile[],
  received: { counts?: Record<string, number>; limits?: Record<string, number> } = {},
) {
  if (
    (input.mode !== "personal" && input.mode !== "group") ||
    !isMatchPriority(input.priority)
  ) {
    throw new Error("TOP 3 계산 입력이 올바르지 않습니다.");
  }
  return rankInfluencers(input, profiles, received);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const input = readJsonBody(request) as RankMatchInput;
    // 수신 한도는 서버에서 직접 센다. 프런트가 보내면 조작할 수 있다.
    const [profiles, received] = await Promise.all([
      loadInfluencerProfiles(),
      loadReceivedRequestCounts(),
    ]);
    response.status(200).json({
      rankedInfluencers: calculateTopThree(input, profiles, received),
      // 후보가 3명 미만일 때 화면이 상태 문구를 고르는 데 쓴다.
      // 인플루언서별 수신 수나 남은 자리는 담지 않는다 (SCREEN_SPEC.md).
      eligibleCount: filterEligibleInfluencers(
        input.mode,
        profiles,
        received.counts,
        received.limits,
      ).length,
    });
  } catch (error) {
    console.error("[BiasFit 매칭] top-three failed", error);
    sendApiError(response, error);
  }
}
