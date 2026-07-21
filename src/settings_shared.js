// Shared helpers для блочных settings-views.
//
// - openSettingsDispatch(): вызывается по клику #settings-btn (main.js).
//   Читает body.dataset.block, запоминает current hash и переводит на
//   соответствующий блочный settings-URL через history.replaceState —
//   settings НЕ попадает в history, TG-Back возвращает на предыдущий view.
// - settingsReturnToPrevious(): back-handler блочных форм; отматывает
//   на сохранённый hash через replaceState + run().
// - renderGeneralPanel(app): переиспользуемый блок «Общие» — переключение
//   языка (единственный tab у client/admin/entry, первый tab у partner).

import { t, LANG_ORDER, getLang, setLang } from "./i18n.js";
import { run } from "./router.js";

const BLOCK_TO_TARGET = {
  entry: "#/settings-entry",
  client: "#/client/settings",
  partner: "#/partner/settings",
  admin: "#/admin/settings",
};

let _returnHash = "#/";

export function openSettingsDispatch() {
  const cur = (location.hash || "#/").split("?")[0];
  const target = BLOCK_TO_TARGET[document.body.dataset.block] || "#/settings-entry";
  if (cur === target) return;
  _returnHash = location.hash || "#/";
  history.replaceState(null, "", target);
  run();
}

export function settingsReturnToPrevious() {
  const target = _returnHash || "#/";
  if (location.hash === target) return;
  history.replaceState(null, "", target);
  run();
}

export function renderGeneralPanel(app) {
  app.innerHTML = `
    <div class="settings-list">
      <div class="settings-item">
        <div class="settings-label">${t("settings.language")}</div>
        <div class="settings-lang-row" id="settings-lang"></div>
      </div>
    </div>
  `;
  renderLangButtons();
}

function renderLangButtons() {
  const row = document.getElementById("settings-lang");
  if (!row) return;
  const lang = getLang();
  row.innerHTML = LANG_ORDER.map((l) => `
    <button class="settings-lang-btn${l === lang ? " active" : ""}" data-lang="${l}" type="button">${l.toUpperCase()}</button>
  `).join("");
  row.querySelectorAll(".settings-lang-btn").forEach((b) => {
    b.onclick = () => {
      setLang(b.dataset.lang);
      // langchange listener в main.js делает run() → re-render формы.
    };
  });
}
