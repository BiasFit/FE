import { requireAccount, sendAuthAwareError } from "../../_lib/auth.js";
import { requirePost, type ApiRequest, type ApiResponse } from "../../_lib/http.js";

/**
 * 로그인한 계정의 역할과 표시 이름을 돌려준다.
 * 화면이 사용자용인지 인플루언서용인지 가르는 데 쓴다 (INFLUENCER_SCREEN_SPEC 3.1).
 *
 * 역할을 브라우저가 기억하게 두면 조작할 수 있으므로 서버에 물어본다.
 */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    const account = await requireAccount(request);
    response.status(200).json({
      accountId: account.accountId,
      role: account.role,
      loginId: account.loginId,
      displayName: account.displayName,
    });
  } catch (error) {
    sendAuthAwareError(response, error);
  }
}
