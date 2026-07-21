// Client settings — только «Общие» (язык). Пустой bottomnav (TBB-28).

import { t } from "../../i18n.js";
import { setTitle, showBack } from "../../topbar.js";
import { setBottomNav } from "../../bottomnav.js";
import { renderGeneralPanel, settingsReturnToPrevious } from "../../settings_shared.js";

export function renderClientSettings() {
  setTitle(t("settings.title"));
  showBack(settingsReturnToPrevious);
  setBottomNav([]);
  renderGeneralPanel(document.getElementById("app"));
}
