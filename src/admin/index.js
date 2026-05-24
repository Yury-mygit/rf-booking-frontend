// Admin block. Views переносятся в Этапе 6 — здесь заглушка.

import { setTitle, showBack } from "../topbar.js";
import { navigate } from "../router.js";

export function render(params) {
  const rest = params.rest || "/";
  setTitle("Админ");
  showBack(() => navigate("#/"));
  document.getElementById("app").innerHTML =
    `<p class="hint">admin block — TODO. path: <code>${rest}</code></p>`;
}
