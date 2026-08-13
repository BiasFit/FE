import { createRouter } from "../_lib/http.js";
import topThree from "../_routes/matches/top-three.js";

/** `/api/matches/top-three` */
export default createRouter({ "top-three": topThree });
