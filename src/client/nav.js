import { t } from "../i18n.js";
import { getLastHotel } from "./state.js";

// SVG-иконки (lucide-style, currentColor).
const ICON_HOTEL = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V8a2 2 0 0 1 1-1.7l8-4.5a2 2 0 0 1 2 0l8 4.5A2 2 0 0 1 23 8v13"/><path d="M3 21h18"/><path d="M9 21V12h6v9"/></svg>`;
const ICON_ROOMS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3"/><path d="M2 16h20"/><path d="M4 21V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M8 21v-4M16 21v-4"/></svg>`;
const ICON_SERVICES = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 4.5L18.5 9l-3.5 3 1 4.5L12 14.5 8 16.5l1-4.5L5.5 9l4.6-1.5z"/></svg>`;
const ICON_BOOKINGS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>`;
const ICON_HOTELS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/></svg>`;

// Bottom-nav клиента. active ∈ {"hotel","rooms","services","bookings","hotels"}.
// Контекстные кнопки (hotel/rooms/services) берут slug из state.lastHotel;
// если отеля нет — ведут на /client/hotels (выбор). Кнопка «Написать» из nav
// убрана 2026-05-29 — точки входа в чат теперь только из контекста (иконка
// на view отеля, на карточке комнаты, на карточке брони).
export function clientNavItems(active) {
  const h = getLastHotel();
  const slug = h ? (h.slug || h.id) : null;
  const hotelHref = (tail) =>
    slug ? `/client/hotel/${encodeURIComponent(slug)}${tail}` : "/client/hotels";

  return [
    {
      key: "hotel",
      label: t("client.nav.hotel"),
      icon: ICON_HOTEL,
      ...(active === "hotel" ? { active: true } : { href: hotelHref("") }),
    },
    {
      key: "rooms",
      label: t("client.nav.rooms"),
      icon: ICON_ROOMS,
      ...(active === "rooms" ? { active: true } : { href: hotelHref("/rooms") }),
    },
    {
      key: "services",
      label: t("client.nav.services"),
      icon: ICON_SERVICES,
      ...(active === "services" ? { active: true } : { href: hotelHref("/services") }),
    },
    {
      key: "bookings",
      label: t("client.nav.bookings"),
      icon: ICON_BOOKINGS,
      ...(active === "bookings" ? { active: true } : { href: "/client/bookings" }),
    },
    {
      key: "hotels",
      label: t("client.nav.hotels"),
      icon: ICON_HOTELS,
      ...(active === "hotels" ? { active: true } : { href: "/client/hotels" }),
    },
  ];
}
