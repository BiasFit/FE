import { createRouter } from "../_lib/http.js";
import me from "../_routes/accounts/me.js";
import upsert from "../_routes/accounts/upsert.js";

/** `/api/accounts/me`, `/api/accounts/upsert` */
export default createRouter({ me, upsert });
