// Bottom-nav для admin-блока. setBottomNav вынесена в src/bottomnav.js.

import { t } from "../i18n.js";
import { setBottomNav } from "../bottomnav.js";

export { setBottomNav };

const SVG_ATTR = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS = {
  metrics: `<svg ${SVG_ATTR}><path d="M3 3v18h18"></path><rect x="7" y="13" width="3" height="5"></rect><rect x="12" y="9" width="3" height="9"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>`,
  users: `<svg ${SVG_ATTR}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  hotels: `<svg ${SVG_ATTR}><path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 9h2v2H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h2v2h-2zM10 21v-4h4v4"></path></svg>`,
  bookings: `<svg ${SVG_ATTR}><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>`,
  // life-buoy
  support: `<svg ${SVG_ATTR}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line></svg>`,
};

const MAIN_ITEMS = [
  { key: "metrics", labelKey: "nav.metrics", icon: ICONS.metrics, href: "/admin/" },
  { key: "users", labelKey: "nav.users", icon: ICONS.users, href: "/admin/users" },
  { key: "hotels", labelKey: "partner.nav.hotels", icon: ICONS.hotels, href: "/admin/hotels" },
  { key: "bookings", labelKey: "nav.bookings", icon: ICONS.bookings, href: "/admin/bookings" },
  { key: "support", labelKey: "nav.support", icon: ICONS.support, href: "/admin/support" },
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

export function activeNavKey(rest) {
  if (rest === "/" || rest === "" || rest === "/metrics") return "metrics";
  if (rest === "/users") return "users";
  if (rest === "/hotels") return "hotels";
  if (rest === "/bookings") return "bookings";
  if (rest.startsWith("/support")) return "support";
  return null;
}
