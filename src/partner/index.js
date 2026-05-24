// Partner block. Views переносятся в Этапе 5 — здесь заглушка.

import { setTitle, showBack } from "../topbar.js";
import { navigate } from "../router.js";

export function render(params) {
  const rest = params.rest || "/";
  setTitle("Партнёр");
  showBack(() => navigate("#/"));
  document.getElementById("app").innerHTML =
    `<p class="hint">partner block — TODO. path: <code>${rest}</code></p>`;
}
