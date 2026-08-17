import { createRouter } from "../_lib/http.js";
import track from "../_routes/events/track.js";

/**
 * `/api/events/track`
 *
 * MVP 테스트 KPI용 화면 이벤트 수집구다 (`MEMO/KPI_측정_계획.md`).
 * 새 주소를 추가하면 여기와 `dev/localApiPlugin.ts` 두 곳에 등록한다.
 */
export default createRouter({ track });
