import { createRouter } from "../_lib/http.js";
import list from "../_routes/requests/list.js";
import send from "../_routes/requests/send.js";

/** `/api/requests/list`, `/api/requests/send` */
export default createRouter({ list, send });
