// Dev-login (без Telegram). В TG WebApp эта страница не открывается —
// bootstrap уже поднимает сессию из initData. Здесь для разработки.

import { api } from "../../api.js";
import { t } from "../../i18n.js";
import { navigate } from "../../router.js";
import { setTitle, showBack } from "../../topbar.js";

export function renderClientLogin() {
  setTitle(t("auth.dev_title"));
  showBack(() => navigate("#/"));

  const app = document.getElementById("app");
  app.innerHTML = `
    <h1>${t("auth.dev_title")}</h1>
    <div class="form-row">
      <label>${t("auth.tg_id")}</label>
      <input id="dev-tg" type="number" value="555001" />
    </div>
    <div class="form-row">
      <label>${t("auth.first_name")}</label>
      <input id="dev-name" value="DevClient" />
    </div>
    <button class="primary" id="dev-go">${t("auth.login")}</button>
    <div id="dev-err" class="error"></div>
    <p class="muted" style="margin-top:14px">
      Это форма входа для разработки. В Telegram WebApp эта страница не появится.
    </p>
  `;
  document.getElementById("dev-go").onclick = async () => {
    const tgId = Number(document.getElementById("dev-tg").value);
    const name = document.getElementById("dev-name").value || "DevClient";
    try {
      const r = await api.authDev(tgId, name, "client");
      api.setSession(r.token, r.user);
      navigate("#/");
    } catch (e) {
      document.getElementById("dev-err").textContent = t("common.error", { msg: e.message });
    }
  };
}
