import { createRouter } from "../_lib/http";
import list from "../_routes/requests/list";
import send from "../_routes/requests/send";

/** `/api/requests/list`, `/api/requests/send` */
export default createRouter({ list, send });
