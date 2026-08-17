import { createRouter } from "../_lib/http.js";
import availability from "../_routes/matches/availability.js";
import topThree from "../_routes/matches/top-three.js";

/** `/api/matches/top-three`, `/api/matches/availability` */
export default createRouter({ "top-three": topThree, availability });
