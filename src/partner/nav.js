// Bottom-nav для partner-блока. setBottomNav вынесена в src/bottomnav.js
// (используется ещё admin/settings).

import { t } from "../i18n.js";
import { setBottomNav } from "../bottomnav.js";

export { setBottomNav };

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS = {
  hotels: `<svg ${SVG_ATTR}><path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2zM10 21v-4h4v4"></path></svg>`,
  rooms: `<svg ${SVG_ATTR}><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7"></path><path d="M3 14h18"></path><path d="M3 18v2M21 18v2"></path><rect x="6" y="10" width="5" height="3" rx="1"></rect></svg>`,
  bookings: `<svg ${SVG_ATTR}><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>`,
  clients: `<svg ${SVG_ATTR}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  staff: `<svg ${SVG_ATTR}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 11l-3 3-2-2"></path></svg>`,
};

const MAIN_ITEMS = [
  { key: "hotels", labelKey: "nav.hotels", icon: ICONS.hotels, href: "/partner/" },
  { key: "rooms", labelKey: "nav.rooms", icon: ICONS.rooms, href: "/partner/rooms" },
  { key: "bookings", labelKey: "nav.bookings", icon: ICONS.bookings, href: "/partner/bookings" },
  { key: "clients", labelKey: "nav.clients", icon: ICONS.clients, href: "/partner/clients" },
  { key: "staff", labelKey: "nav.staff", icon: ICONS.staff, href: "/partner/staff" },
];

export function renderMainNav(activeKey) {
  setBottomNav(
    MAIN_ITEMS.map((it) => ({
      ...it,
      label: t(it.labelKey),
      active: it.key === activeKey,
    })),
  );
}

// Какой пункт главного nav подсветить по текущему partner-пути.
//   rest = "/" | "/rooms" | "/bookings" | "/clients" | "/staff" | "/audit"
//        | "/hotel/<id>" | "/hotel/<id>/rooms" | "/room/.../..." | "/client/<id>"
export function activeNavKey(rest) {
  if (rest === "/" || rest === "" || rest.startsWith("/hotel/")) return "hotels";
  if (rest === "/rooms" || rest.startsWith("/room/")) return "rooms";
  if (rest === "/bookings") return "bookings";
  if (rest === "/clients" || rest.startsWith("/client/")) return "clients";
  if (rest === "/staff" || rest === "/audit") return "staff";
  return null;
}
