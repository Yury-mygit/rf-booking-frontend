// Client block. Views переносятся из rf-booking-frontend-client в Этапе 4.
// Здесь — заглушка с одним маршрутом-плейсхолдером.

import { t } from "../i18n.js";
import { setTitle, showBack } from "../topbar.js";
import { navigate } from "../router.js";

export function render(params) {
  const rest = params.rest || "/";
  setTitle(t("client.app_name"));
  showBack(() => navigate("#/"));
  document.getElementById("app").innerHTML =
    `<p class="hint">client block — TODO. path: <code>${rest}</code></p>`;
}
