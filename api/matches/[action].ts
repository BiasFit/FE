import { createRouter } from "../_lib/http";
import topThree from "../_routes/matches/top-three";

/** `/api/matches/top-three` */
export default createRouter({ "top-three": topThree });
