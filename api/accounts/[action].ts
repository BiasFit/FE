import { createRouter } from "../_lib/http";
import me from "../_routes/accounts/me";
import upsert from "../_routes/accounts/upsert";

/** `/api/accounts/me`, `/api/accounts/upsert` */
export default createRouter({ me, upsert });
