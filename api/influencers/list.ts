import { loadInfluencerProfiles } from "../_lib/influencerProfiles";
import {
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http";

/**
 * 프로필이 완료된 스타일메이트 전체를 돌려준다.
 * 화면이 TOP 3 카드의 소개·가격대·강점 TPO를 표시할 때 쓴다.
 *
 * 수신 요청 수나 남은 자리는 담지 않는다. 사용자에게 표시하지 않는 값이다
 * (STYLE_SCORING_DRAFT.md 3장).
 */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    response.status(200).json({ influencers: await loadInfluencerProfiles() });
  } catch (error) {
    console.error("[BiasFit 매칭] influencers/list failed", error);
    sendApiError(response, error);
  }
}
