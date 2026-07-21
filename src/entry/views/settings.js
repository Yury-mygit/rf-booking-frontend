// Entry settings — только «Общие» (язык). Пустой bottomnav (TBB-28).
//
// Регистрируется отдельным маршрутом #/settings-entry в main.js (у entry-
// блока нет URL-префикса, чтобы не заводить блочный dispatcher).

import { t } from "../../i18n.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { renderGeneralPanel, settingsReturnToPrevious } from "../../settings_shared.js";

export function renderEntrySettings() {
  document.body.dataset.block = "entry";
  setTitle(t("settings.title"));
  showBack(settingsReturnToPrevious);
  setBottomNav([]);
  renderGeneralPanel(document.getElementById("app"));
}
