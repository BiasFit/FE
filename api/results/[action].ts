import { createRouter } from "../_lib/http.js";
import get from "../_routes/results/get.js";
import save from "../_routes/results/save.js";

/** `/api/results/get`, `/api/results/save` */
export default createRouter({ get, save });
