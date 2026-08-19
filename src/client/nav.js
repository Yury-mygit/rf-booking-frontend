import { t } from "../i18n.js";

// SVG-иконки (lucide-style, currentColor).
const ICON_BOOKINGS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>`;
const ICON_HOTELS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/></svg>`;

// Bottom-nav клиента. 2 пункта: отели / брони. active ∈ {"hotels","bookings"}.
// На /client/hotel/<slug> и дочерних экранах отеля nav скрывается через
// hideBottomNav (см. TBB-59).
export function clientNavItems(active) {
  return [
    {
      key: "hotels",
      label: t("client.nav.hotels"),
      icon: ICON_HOTELS,
      ...(active === "hotels" ? { active: true } : { href: "/client/hotels" }),
    },
    {
      key: "bookings",
      label: t("client.nav.bookings"),
      icon: ICON_BOOKINGS,
      ...(active === "bookings" ? { active: true } : { href: "/client/bookings" }),
    },
  ];
}
