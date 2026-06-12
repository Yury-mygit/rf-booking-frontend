// Inline SVG icons for amenities. Используются в client/book.js
// (icon-only chips) и при желании — partner-форм. Стилевые атрибуты
// (stroke/fill) задаются через `currentColor`, чтобы внешний контейнер
// определял цвет.
//
// 24x24 viewBox, stroke-line style (Lucide-like).

const A = 'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const AMENITY_ICONS = {
  // hotel general
  atm: `<svg ${A}><rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path><path d="M14 15h3"></path></svg>`,
  reception_24h: `<svg ${A}><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>`,
  elevator: `<svg ${A}><rect x="4" y="3" width="16" height="18" rx="1"></rect><path d="M9 9l3-3 3 3"></path><path d="M9 15l3 3 3-3"></path></svg>`,
  press: `<svg ${A}><rect x="3" y="5" width="18" height="14" rx="1"></rect><path d="M7 9h6M7 13h10M7 17h7"></path></svg>`,
  express_checkin: `<svg ${A}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"></path></svg>`,
  // hotel dining
  bar: `<svg ${A}><path d="M5 4h14l-7 8-7-8z"></path><path d="M12 12v8"></path><path d="M8 20h8"></path></svg>`,
  free_tea_coffee: `<svg ${A}><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"></path><path d="M16 10h2a2 2 0 0 1 0 4h-2"></path><path d="M8 4c0 1 1 1 1 2s-1 1-1 2"></path><path d="M12 4c0 1 1 1 1 2s-1 1-1 2"></path></svg>`,
  breakfast: `<svg ${A}><path d="M2 12a10 10 0 0 1 20 0"></path><path d="M2 12h20"></path><path d="M6 8l1-2M12 7V5M18 8l-1-2"></path></svg>`,
  restaurant: `<svg ${A}><path d="M7 2v20"></path><path d="M5 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"></path><path d="M17 22V11a3 3 0 0 1 3-3V2"></path></svg>`,
  // room in_room
  air_conditioning: `<svg ${A}><path d="M12 2v20"></path><path d="M2 12h20"></path><path d="M4.93 4.93l14.14 14.14"></path><path d="M19.07 4.93L4.93 19.07"></path></svg>`,
  non_smoking: `<svg ${A}><rect x="3" y="13" width="14" height="4" rx="1"></rect><path d="M17 13v4"></path><path d="M14 9c0-2 2-2 2-4M18 9c0-2 2-2 2-4"></path><line x1="3" y1="3" x2="21" y2="21"></line></svg>`,
  room_service: `<svg ${A}><path d="M3 18h18"></path><path d="M5 18a7 7 0 0 1 14 0"></path><path d="M12 7v4"></path><circle cx="12" cy="5" r="1.5"></circle></svg>`,
  tv: `<svg ${A}><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M8 22l4-4 4 4"></path></svg>`,
  bathrobe: `<svg ${A}><path d="M7 3l5 4 5-4"></path><path d="M7 3v4l-3 3v11h16V10l-3-3V3"></path><path d="M12 11v8"></path></svg>`,
  safe: `<svg ${A}><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="14" cy="12" r="3"></circle><path d="M14 9v1M14 14v1M11 12h1M16 12h1"></path></svg>`,
  toiletries: `<svg ${A}><path d="M8 2h8l-1 4H9z"></path><rect x="6" y="6" width="12" height="16" rx="2"></rect><path d="M9 12h6"></path></svg>`,
  // room services
  ironing_supplies: `<svg ${A}><path d="M3 20h18"></path><path d="M3 20V8h10l4 4v8"></path><path d="M7 14h6"></path></svg>`,
  ironing_service: `<svg ${A}><path d="M3 16h18"></path><path d="M3 16V9h10l4 3v4"></path><path d="M6 20c1-2 2-2 3 0M11 20c1-2 2-2 3 0M16 20c1-2 2-2 3 0"></path></svg>`,
  shoe_cleaning: `<svg ${A}><path d="M3 18h18"></path><path d="M3 18l1-9h6l3 4h5a2 2 0 0 1 2 2v3"></path><path d="M7 13h2"></path></svg>`,
  luggage_storage: `<svg ${A}><rect x="5" y="7" width="14" height="14" rx="2"></rect><path d="M9 7V4h6v3"></path><path d="M9 12v4M15 12v4"></path></svg>`,
  phone: `<svg ${A}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.27a2 2 0 0 1 2.11-.45c.83.34 1.71.57 2.61.7A2 2 0 0 1 22 16.92z"></path></svg>`,
  iron: `<svg ${A}><path d="M3 18h18"></path><path d="M3 18V10c3-3 9-3 14-3l4 4v7"></path></svg>`,
};

export function amenityIconHtml(kind) {
  return AMENITY_ICONS[kind] || "";
}
