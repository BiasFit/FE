import { createRouter } from "../_lib/http";
import get from "../_routes/results/get";
import save from "../_routes/results/save";

/** `/api/results/get`, `/api/results/save` */
export default createRouter({ get, save });
