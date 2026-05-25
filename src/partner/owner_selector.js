// Owner-selector в topbar для partner-блока. Видим только когда у юзера ≥2
// доступных owner'а (себя + чужие отели как staff). При смене — emit
// `ownerchange` (api.setActiveOwnerId), который main.js слышит и делает run().

import { api } from "../api.js";
import { t } from "../i18n.js";
import { escapeAttr } from "../util.js";

export function mountOwnerSelector() {
  const sel = document.getElementById("owner-selector");
  if (!sel) return;

  const owners = api.owners();
  if (owners.length === 0) {
    sel.hidden = true;
    return;
  }

  sel.hidden = owners.length < 2;

  const active = api.activeOwnerId();
  sel.innerHTML = owners
    .map((o) => {
      const label = o.is_self
        ? t("owner.you", { name: o.owner_display_name || "—" })
        : (o.owner_display_name || `Owner #${o.owner_user_id}`);
      return `<option value="${o.owner_user_id}" ${o.owner_user_id === active ? "selected" : ""}>${escapeAttr(label)}</option>`;
    })
    .join("");

  sel.onchange = () => {
    const id = Number(sel.value);
    api.setActiveOwnerId(id);
  };
}
