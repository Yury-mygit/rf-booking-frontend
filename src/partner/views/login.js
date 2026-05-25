// Dev-login для partner (без Telegram). В TG WebApp этот view не открывается.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { setTitle } from "../../topbar.js";
import { navigate } from "../../router.js";

export function renderPartnerLogin() {
  const app = document.getElementById("app");
  setTitle(t("pageTitle.devLogin"));
  app.innerHTML = `
    <div class="form-row"><label>${t("auth.tg_id")}</label>
      <input id="dev-tg" type="number" value="999001" /></div>
    <div class="form-row"><label>${t("auth.first_name")}</label>
      <input id="dev-name" value="DemoPartner" /></div>
    <button class="primary full" id="dev-go">${t("auth.login")}</button>
    <div id="dev-err" class="error"></div>
    <p class="muted" style="margin-top:14px">
      Партнёр-вход для разработки. В Telegram WebApp эта страница не появится.
    </p>
  `;
  document.getElementById("dev-go").onclick = async () => {
    try {
      const r = await api.authDev(
        Number(document.getElementById("dev-tg").value),
        document.getElementById("dev-name").value || "DevPartner",
        "partner",
      );
      api.setSession(r.token, r.user, r.accessible_owners || []);
      navigate("#/partner/");
    } catch (e) {
      document.getElementById("dev-err").textContent = t("common.error", { msg: e.message });
    }
  };
}
