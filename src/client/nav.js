import { t } from "../i18n.js";
import { getLastHotel } from "./state.js";

// SVG-иконки (lucide-style, currentColor).
const ICON_HOTEL = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V8a2 2 0 0 1 1-1.7l8-4.5a2 2 0 0 1 2 0l8 4.5A2 2 0 0 1 23 8v13"/><path d="M3 21h18"/><path d="M9 21V12h6v9"/></svg>`;
const ICON_ROOMS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3"/><path d="M2 16h20"/><path d="M4 21V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M8 21v-4M16 21v-4"/></svg>`;
const ICON_SERVICES = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 4.5L18.5 9l-3.5 3 1 4.5L12 14.5 8 16.5l1-4.5L5.5 9l4.6-1.5z"/></svg>`;
const ICON_WRITE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const ICON_BOOKINGS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>`;
const ICON_HOTELS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/></svg>`;

// Bottom-nav клиента. active ∈ {"hotel","rooms","services","write","bookings","hotels"}.
// Контекстные кнопки (hotel/rooms/services/write) берут slug из state.lastHotel;
// если отеля нет — ведут на /client/hotels (выбор). "Забронировать" из nav
// убрана 2026-05-28 — бронь только из карточки номера; на её месте кнопка
// «Написать» (заглушка до Этапа 2-5 карты client-hotel-chat).
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
      key: "write",
      label: t("client.nav.write"),
      icon: ICON_WRITE,
      onClick: () => alert(t("chat.coming_soon")),
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
