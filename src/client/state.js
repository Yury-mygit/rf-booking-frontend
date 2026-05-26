// Shared client state — последний открытый отель. Используется вью
// /bookings и /services чтобы показать данные по отелю, в который юзер
// заходил (после удаления вкладок с формы "Забронировать").
let _lastHotel = null;

export function setLastHotel(h) {
  _lastHotel = h;
}

export function getLastHotel() {
  return _lastHotel;
}
