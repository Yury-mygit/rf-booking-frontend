// Settings view — общий для всех блоков. Открывается из шестерёнки в
// topbar (#settings-btn) через openSettings(); back возвращает на тот
// hash, с которого пришли.
//
// Пока в настройках только выбор языка. Маршрут — top-level #/settings,
// не привязан к блоку.

import { t, LANG_ORDER, getLang, setLang } from "./i18n.js";
import { navigate } from "./router.js";
import { setTitle, showBack } from "./topbar.js";

let _returnHash = "#/";

export function openSettings() {
  // Запоминаем откуда пришли — на момент клика по шестерёнке URL ещё
  // показывает текущий view. Если уже на /settings — возврат в hub.
  const cur = location.hash || "#/";
  _returnHash = cur.split("?")[0] === "#/settings" ? "#/" : cur;
  navigate("#/settings");
}

export function renderSettings() {
  setTitle(t("settings.title"));
  showBack(() => navigate(_returnHash));

  const app = document.getElementById("app");
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
      // langchange listener в main.js делает run() — re-render всей
      // страницы с новым языком (включая эту самую settings).
    };
  });
}
