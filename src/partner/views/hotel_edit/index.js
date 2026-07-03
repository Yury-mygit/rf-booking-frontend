// Hotel-hub — «форма отеля с вкладками» (TBB-16, 2026-07-02).
// URL остаётся source-of-truth (deeplink работает), но переключение
// hub'а/subform'а — не view swap, а показ persistent DOM-контейнера.
//
// Единая модель `HUB_STRUCTURE`: каждый hub — набор subform'ов с одним
// default. Status: 4 subform'а (readiness/share/rooms/bookings). Остальные
// hub'ы (description/photos/amenities) — 1 subform key=`main`. Subnav
// отображается только когда у hub'а > 1 subform'а.
//
// Shell строится ОДИН РАЗ при первом заходе в отель: `#app` содержит
// `#hub-body`, внутри — 7 контейнеров `.hub-tab[data-tab="hub.sub"]` (по
// одному на каждую пару). Переключение = `hidden = true/false` соседей +
// `render(body, id)` активной вкладки. Никаких `#app.innerHTML` swap'ов,
// никаких повторных `api.getHotel`.
//
// Refresh-on-show: каждая вкладка перерендеривается КАЖДЫЙ раз при
// показе (стейл не показываем; `feedback_commercial_no_shortcuts`).
//
// isNew=true — рендерим форму без hub-shell'а (id ещё нет).

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setTitle } from "../../../topbar.js";
import { setBottomNav, setSubBottomNav } from "../../nav.js";

import { renderReadinessSubform } from "./readiness_subform.js";
import { renderShareTab } from "./share_tab.js";
import { renderDescriptionTab, renderNewHotelForm } from "./description_tab.js";
import { renderPhotosTab } from "./photos_tab.js";
import { renderAmenitiesTab } from "./amenities_tab.js";
import { renderRoomsSubform } from "../rooms_list.js";
import { renderBookingsSubform } from "../bookings.js";

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TAB_ICONS = {
  status: `<svg ${SVG_ATTR}><path d="M3 3v18h18"></path><rect x="7" y="13" width="3" height="5"></rect><rect x="12" y="9" width="3" height="9"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>`,
  description: `<svg ${SVG_ATTR}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8M8 17h6M8 9h2"></path></svg>`,
  photos: `<svg ${SVG_ATTR}><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  amenities: `<svg ${SVG_ATTR}><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
};

const SUB_ICONS = {
  readiness: TAB_ICONS.status,
  share: `<svg ${SVG_ATTR}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"></path></svg>`,
  rooms: `<svg ${SVG_ATTR}><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7"></path><path d="M3 18h18"></path><path d="M7 11V8h4v3"></path><path d="M13 11V8h4v3"></path></svg>`,
  bookings: `<svg ${SVG_ATTR}><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="8 14 11 17 16 12"></polyline></svg>`,
  general: TAB_ICONS.amenities,
  dining: TAB_ICONS.amenities,
  placement: TAB_ICONS.amenities,
};

// Единая модель hub'а: список subform'ов + default. Порядок subform'ов
// определяет порядок subnav-items. render-функции лежат в RENDERERS
// (индексируются `${hub}.${sub}`).
const HUB_STRUCTURE = {
  status: {
    subforms: [
      { key: "readiness", labelKey: "status.subforms.readiness" },
      { key: "share",     labelKey: "status.actions.share" },
      { key: "rooms",     labelKey: "status.actions.rooms" },
      { key: "bookings",  labelKey: "status.actions.bookings" },
    ],
    default: "readiness",
  },
  description: { subforms: [{ key: "main" }], default: "main" },
  photos:      { subforms: [{ key: "main" }], default: "main" },
  amenities: {
    subforms: [
      { key: "general",   labelKey: "amenity.subforms.general" },
      { key: "dining",    labelKey: "amenity.subforms.dining" },
      { key: "placement", labelKey: "amenity.subforms.placement" },
    ],
    default: "general",
  },
};

const HUBS = Object.keys(HUB_STRUCTURE);

const RENDERERS = {
  "status.readiness": (body, id) => renderReadinessSubform(body, id),
  "status.share":     (body) => renderShareTab(body),
  "status.rooms":     (body, id) => renderRoomsSubform(body, id),
  "status.bookings":  (body, id) => renderBookingsSubform(body, id),
  "description.main":     (body, id) => renderDescriptionTab(body, id),
  "photos.main":          (body, id) => renderPhotosTab(body, id),
  "amenities.general":    (body, id) => renderAmenitiesTab(body, id, "general"),
  "amenities.dining":     (body, id) => renderAmenitiesTab(body, id, "dining"),
  "amenities.placement":  (body, id) => renderAmenitiesTab(body, id, "placement"),
};

const TAB_KEYS = Object.keys(RENDERERS);

// Breadcrumb: `main` — тавтологичен с hub'ом (описание/фото/удобства
// имеют одну вкладку), в title'е его не показываем.
const SUB_LABEL_KEY = {
  readiness: "status.subforms.readiness",
  share: "status.actions.share",
  rooms: "status.actions.rooms",
  bookings: "status.actions.bookings",
  general: "amenity.subforms.general",
  dining: "amenity.subforms.dining",
  placement: "amenity.subforms.placement",
};

export function buildBreadcrumb({ hub, sub, tail } = {}) {
  const parts = [t("pageTitle.hotelEdit")];
  if (hub) parts.push(t("edit.section." + hub));
  if (sub && SUB_LABEL_KEY[sub]) parts.push(t(SUB_LABEL_KEY[sub]));
  let out = parts.join(" / ");
  if (tail) out += ` — ${tail}`;
  return out;
}

export const state = { hotel: null, rooms: [] };

// Какой hotelId сейчас смонтирован в `#hub-body`. Если следующий заход —
// тот же id и shell на месте, ничего не пересоздаём.
let _mountedHotelId = null;

function hubUrl(id, hub) {
  const struct = HUB_STRUCTURE[hub];
  if (struct.subforms.length > 1) {
    return `#/partner/hotel/${id}/${hub}/${struct.default}`;
  }
  return `#/partner/hotel/${id}/${hub}`;
}

function tabKeyFor(hub, sub) {
  const struct = HUB_STRUCTURE[hub];
  const actualSub = sub || struct.default;
  return `${hub}.${actualSub}`;
}

function hasMultipleSubforms(hub) {
  return HUB_STRUCTURE[hub].subforms.length > 1;
}

export function setHotelTabsNav(id, activeHub) {
  setBottomNav(
    HUBS.map((name) => ({
      key: name,
      label: t("edit.section." + name),
      icon: TAB_ICONS[name],
      active: name === activeHub,
      onClick: () => navigate(hubUrl(id, name)),
    })),
  );
}

// Sub-bottomnav поднимается только для hub'ов с > 1 subform'ом. Сейчас
// это только Status, но реализация generic — при добавлении subform'ов в
// другой hub панель поднимется автоматически.
//
// State "у формы отеля есть subnav" живёт на `#hub-body` (НЕ на `<body>`),
// чтобы invalidation при смене hub'а был localized в subtree hub-body и
// не задевал fixed-панели bottomnav/subnav (см. per-project/booking.md,
// раздел Hub-tab form primitive).
export function mountHubSubnav(id, hub, activeSub) {
  const subforms = HUB_STRUCTURE[hub].subforms;
  document.getElementById("hub-body")?.classList.add("has-subnav");
  setSubBottomNav(
    subforms.map((sf) => ({
      key: sf.key,
      label: sf.labelKey ? t(sf.labelKey) : "",
      icon: SUB_ICONS[sf.key] || TAB_ICONS[hub],
      active: sf.key === activeSub,
      onClick: () => navigate(`#/partner/hotel/${id}/${hub}/${sf.key}`),
    })),
  );
}

// Скрытие subnav внутри hotel-hub'а — БЕЗ трогания body-класса.
// hideSubBottomNav из bottomnav.js делает `body.classList.remove
// ("has-subnav")` (это нужно для staff/audit view'ов); в hotel-hub мы
// работаем на уровне #hub-body — иначе invalidation по всему body
// приведёт к перекрашиванию bottomnav.
function hideHubSubnav() {
  const nav = document.getElementById("subbottomnav");
  if (nav) {
    nav.hidden = true;
    nav.innerHTML = "";
    delete nav.dataset.bnShape;
  }
  document.getElementById("hub-body")?.classList.remove("has-subnav");
}

// Refresh активной вкладки без переключения (photos_tab после upload/delete,
// readiness_subform после statusChange).
export async function renderTabBody(id, hub, sub) {
  const key = tabKeyFor(hub, sub);
  const bodyEl = document.querySelector(`.hub-tab[data-tab="${key}"]`);
  if (!bodyEl) return;
  const render = RENDERERS[key];
  if (!render) return;
  await render(bodyEl, id);
}

// Строит `#hub-body` с 7 пустыми контейнерами при первом заходе, no-op
// при повторных вызовах для того же hotelId.
async function ensureHubShell(id) {
  const app = document.getElementById("app");
  const existing = document.getElementById("hub-body");
  if (_mountedHotelId === id && existing && state.hotel && state.hotel.id === id) {
    return existing;
  }
  app.innerHTML = t("app.loading");
  try {
    state.hotel = await api.getHotel(id);
  } catch (e) {
    app.innerHTML = `<div class="error">${t("app.error", { msg: e.message })}</div>`;
    _mountedHotelId = null;
    return null;
  }
  app.innerHTML = `<div id="hub-body">${TAB_KEYS.map(
    (k) => `<div class="hub-tab" data-tab="${k}" hidden></div>`,
  ).join("")}</div>`;
  _mountedHotelId = id;
  return document.getElementById("hub-body");
}

async function showTab(id, key) {
  const hubBody = document.getElementById("hub-body");
  if (!hubBody) return;
  const render = RENDERERS[key];
  if (!render) return;
  const bodyEl = hubBody.querySelector(`.hub-tab[data-tab="${key}"]`);
  // Render В СКРЫТУЮ вкладку ДО toggle'а видимости. Иначе `await render(…)`
  // создаёт microtask boundary между «tab стал visible, но пустой» и
  // «tab заполнен» — браузер успевает paint'нуть промежуточное пустое
  // состояние. Длительность визуального flash'а зависит от того, сколько
  // времени провёл awaited render (для async — сеть), поэтому мигание
  // варьировалось по «нагрузке сети». Теперь render завершается пока
  // вкладка ещё hidden; toggle делает её visible уже с готовым контентом.
  await render(bodyEl, id);
  hubBody.querySelectorAll(".hub-tab").forEach((el) => {
    el.hidden = el.dataset.tab !== key;
  });
}

export async function renderHotelHub({ id, hub = "status", sub = null }) {
  if (id === "new") {
    _mountedHotelId = null;
    const app = document.getElementById("app");
    app.innerHTML = t("app.loading");
    setTitle(`${t("pageTitle.hotelEdit")} / ${t("hotel.title.new")}`);
    renderNewHotelForm(app);
    return;
  }

  const body = await ensureHubShell(id);
  if (!body) return;

  const struct = HUB_STRUCTURE[hub];
  if (!struct) return;
  const resolvedSub = sub || struct.default;
  const key = `${hub}.${resolvedSub}`;

  setHotelTabsNav(id, hub);
  if (hasMultipleSubforms(hub)) {
    mountHubSubnav(id, hub, resolvedSub);
  } else {
    hideHubSubnav();
  }
  setTitle(buildBreadcrumb({ hub, sub: resolvedSub, tail: state.hotel?.name_ru }));
  await showTab(id, key);
}
