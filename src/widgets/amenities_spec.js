// Единая спецификация amenities: список enum'ов, группировка по
// секциям, флаг «может ли быть платным». Источник правды для
// partner-форм и client-чипсов.
//
// Соответствует backend enums (app/models/models.py):
//   HotelAmenity — 9 значений (general + dining)
//   RoomAmenity  — 13 значений (in_room + services)
// + ROOM_AMENITIES_PAID_ALLOWED — подмножество где paid:bool разрешён.

export const HOTEL_AMENITIES_BY_SECTION = [
  {
    section: "general",
    kinds: ["atm", "reception_24h", "elevator", "press", "express_checkin", "wifi", "parking", "heating"],
  },
  {
    section: "dining",
    kinds: ["bar", "free_tea_coffee", "breakfast", "restaurant"],
  },
];

export const ROOM_AMENITIES_BY_SECTION = [
  {
    section: "in_room",
    kinds: ["air_conditioning", "non_smoking", "room_service", "tv", "bathrobe", "wifi", "heating", "safe", "toiletries"],
  },
  {
    section: "services",
    kinds: ["ironing_supplies", "ironing_service", "shoe_cleaning", "luggage_storage", "phone", "iron"],
  },
];

export const ROOM_PAID_ALLOWED = new Set([
  "ironing_supplies", "ironing_service", "shoe_cleaning",
  "luggage_storage", "phone", "iron",
]);

export const ALL_HOTEL_KINDS = HOTEL_AMENITIES_BY_SECTION.flatMap((s) => s.kinds);
export const ALL_ROOM_KINDS = ROOM_AMENITIES_BY_SECTION.flatMap((s) => s.kinds);
