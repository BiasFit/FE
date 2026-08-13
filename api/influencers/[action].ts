import { createRouter } from "../_lib/http";
import list from "../_routes/influencers/list";
import upsert from "../_routes/influencers/upsert";

/** `/api/influencers/list`, `/api/influencers/upsert` */
export default createRouter({ list, upsert });
