// Canned Responses: модель и endpoints в v1, UI отложен на v1.5.
// Показываем "coming soon" + ссылку на API.

import "../../../styles/support.css";

import { t } from "../../../i18n.js";
import { renderSupportSubNav } from "./_nav.js";

export async function renderAdminSupportCanned() {
  const root = document.getElementById("app");
  root.innerHTML = `
    ${renderSupportSubNav("canned")}
    <div class="support-mgmt">
      <p class="muted">${t("support.canned.coming_soon")}</p>
    </div>
  `;
}
