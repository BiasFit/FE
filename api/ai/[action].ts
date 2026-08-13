import { createRouter } from "../_lib/http.js";
import matchExplanations from "../_routes/ai/match-explanations.js";
import priorityOptions from "../_routes/ai/priority-options.js";
import styleDnaExplanation from "../_routes/ai/style-dna-explanation.js";

/** AI1 · AI2 · AI4. 주소는 그대로다 — `/api/ai/priority-options` 등. */
export default createRouter({
  "priority-options": priorityOptions,
  "style-dna-explanation": styleDnaExplanation,
  "match-explanations": matchExplanations,
});
