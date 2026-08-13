import { createRouter } from "../_lib/http.js";
import list from "../_routes/influencers/list.js";
import upsert from "../_routes/influencers/upsert.js";

/** `/api/influencers/list`, `/api/influencers/upsert` */
export default createRouter({ list, upsert });
