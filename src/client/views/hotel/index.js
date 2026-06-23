// Public entrypoint для hotel block — re-export 5 render-функций.
// _shared.js хранит state + helpers; impl per view — в соседних файлах.

export { renderHotelDetail } from "./detail.js";
export { renderHotelRooms } from "./rooms.js";
export { renderHotelServices } from "./services.js";
export { renderHotelBookConfirm } from "./book.js";
export { renderHotelMap } from "./map.js";
export { renderHotelDates } from "./dates.js";
export { renderHotelGuests } from "./guests.js";
