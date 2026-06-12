// Hotel edit screen: 4 вкладки (status/share/description/photos).
// _state хранит данные текущего отеля + активный таб. Tabs импортируют
// state и switchTab отсюда; switchTab — единственная точка переключения.
//
// На случай isNew=true (создание нового отеля) рендерим только форму
// описания без вкладок (id=new ещё нет).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { setTitle } from "../../../topbar.js";
import { setBottomNav } from "../../nav.js";

import { renderStatusTab } from "./status_tab.js";
import { renderShareTab } from "./share_tab.js";
import { renderDescriptionTab, renderNewHotelForm } from "./description_tab.js";
import { renderPhotosTab } from "./photos_tab.js";
import { renderAmenitiesTab } from "./amenities_tab.js";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TAB_ICONS = {
  status: `<svg ${SVG_ATTR}><path d="M3 3v18h18"></path><rect x="7" y="13" width="3" height="5"></rect><rect x="12" y="9" width="3" height="9"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>`,
  share: `<svg ${SVG_ATTR}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"></path></svg>`,
  description: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8M8 17h6M8 9h2"></path></svg>`,
  photos: `<svg ${SVG_ATTR}><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  amenities: `<svg ${SVG_ATTR}><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
};

const TABS = ["status", "share", "description", "photos", "amenities"];

export const state = { hotel: null, rooms: [], active: "status" };

export function setHotelTabsNav(id) {
  setBottomNav(
    TABS.map((name) => ({
      key: name,
      label: t("edit.section." + name),
      icon: TAB_ICONS[name],
      active: name === state.active,
      onClick: () => switchTab(name, id),
    })),
  );
}

export function switchTab(name, id) {
  state.active = name;
  setHotelTabsNav(id);
  const body = document.getElementById("tab-body");
  if (name === "status") return renderStatusTab(body, id);
  if (name === "share") return renderShareTab(body);
  if (name === "description") return renderDescriptionTab(body, id);
  if (name === "photos") return renderPhotosTab(body, id);
  if (name === "amenities") return renderAmenitiesTab(body, id);
}

export async function renderHotelEdit({ id }) {
  const isNew = id === "new";
  const app = document.getElementById("app");
  app.innerHTML = t("app.loading");

  if (isNew) {
    setTitle(`${t("pageTitle.hotelEdit")} / ${t("hotel.title.new")}`);
    renderNewHotelForm(app);
    return;
  }

  try {
    state.hotel = await api.getHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    return;
  }

  setTitle(`${t("pageTitle.hotelEdit")} / ${t("hotel.title.edit")}`);
  app.innerHTML = `<div id="tab-body"></div>`;
  setHotelTabsNav(id);
  switchTab(state.active, id);
}
