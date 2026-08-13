import { createRouter } from "../_lib/http.js";
import deliver from "../_routes/outfit/deliver.js";
import get from "../_routes/outfit/get.js";
import review from "../_routes/outfit/review.js";

/**
 * `/api/outfit/deliver`, `/api/outfit/get`, `/api/outfit/review`
 *
 * `review`는 Phase G에서 `deliver`가 검수를 안에서 돌리게 되면서 프런트에서
 * 부르는 곳이 없어졌다. 로그인 검사도 없다. 남길지 닫을지는 아직 결정 전이라
 * 지금은 그대로 둔다 — 어차피 이 폴더 안에 있어 함수 개수에는 영향이 없다.
 */
export default createRouter({ deliver, get, review });
