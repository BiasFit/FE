import { createRouter } from "../_lib/http";
import matchExplanations from "../_routes/ai/match-explanations";
import priorityOptions from "../_routes/ai/priority-options";
import styleDnaExplanation from "../_routes/ai/style-dna-explanation";

/** AI1 · AI2 · AI4. 주소는 그대로다 — `/api/ai/priority-options` 등. */
export default createRouter({
  "priority-options": priorityOptions,
  "style-dna-explanation": styleDnaExplanation,
  "match-explanations": matchExplanations,
});
