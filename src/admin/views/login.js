// Dev-вход для admin (без Telegram). В TG WebApp этот view не открывается.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { setTitle } from "../../topbar.js";
import { navigate } from "../../router.js";

export function renderAdminLogin() {
  const app = document.getElementById("app");
  setTitle(t("pageTitle.adminLogin"));
  app.innerHTML = `
    <div class="form-row"><label>${t("auth.tg_id")}</label>
      <input id="dev-tg" type="number" value="777001" /></div>
    <div class="form-row"><label>${t("auth.first_name")}</label>
      <input id="dev-name" value="DevAdmin" /></div>
    <button class="primary full" id="dev-go">${t("auth.login")}</button>
    <div id="dev-err" class="error"></div>
    <p class="muted" style="margin-top:14px">${t("auth.hint")}</p>
  `;
  document.getElementById("dev-go").onclick = async () => {
    try {
      const r = await api.authDev(
        Number(document.getElementById("dev-tg").value),
        document.getElementById("dev-name").value || "DevAdmin",
        "admin",
      );
      api.setSession(r.token, r.user, r.accessible_owners || []);
      navigate("#/admin/");
    } catch (e) {
      document.getElementById("dev-err").textContent = t("app.error", { msg: e.message });
    }
  };
}
