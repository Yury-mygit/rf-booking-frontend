// Danger-zone subform (TBB-21): вынесен из readiness — отдельная вкладка
// «Опасная зона» под hub'ом Статус. Одинокая карточка «Опасная зона» с
// title / body / кнопкой Delete. Confirm остаётся стандартный (custom-modal
// — отдельная story). Backend сам режектит удаление при активных бронях.
//
// Показ обусловлен `canManageHotel` — при отсутствии permission subform
// пустой (subnav item показывается всегда, чтобы не менять shape панели).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";

import { state } from "./index.js";

export function renderDeleteSubform(body, id) {
  const h = state.hotel;
  const canManageHotel = api.canDo("manage_hotel", h?.owner_user_id);

  if (!canManageHotel) {
    // Без manage_hotel — subform пустой. Отдельный i18n ключ для permission-
    // denied не заводим ради одного места; пункт subnav'а остаётся видимым
    // (unify shape панели), но контент не рендерится.
    body.innerHTML = "";
    return;
  }

  body.innerHTML = `
    <div class="danger-zone">
      <h3>${t("status.danger.title")}</h3>
      <p class="muted">${t("status.danger.body")}</p>
      <button class="danger" id="btn-del">${t("app.delete")}</button>
    </div>
  `;

  document.getElementById("btn-del").onclick = async () => {
    if (!confirm(t("hotel.delete_confirm"))) return;
    try {
      await api.deleteHotel(id);
      navigate("#/partner/");
    } catch (e) {
      alert(e.message);
    }
  };
}
