// Client-side endpoints: /c/* (auth required) + /public/* (anonymous).

import { call } from "./http.js";

export const client = {
  hotelDetails(id, params = {}) {
    const qs = new URLSearchParams();
    // Backend requires both check_in and check_out together or neither.
    const hasBothDates = params.check_in && params.check_out;
    for (const [k, v] of Object.entries(params)) {
      if (v === "" || v == null) continue;
      if ((k === "check_in" || k === "check_out") && !hasBothDates) continue;
      qs.set(k, v);
    }
    return call("GET", `/public/hotels/${id}${qs.toString() ? "?" + qs : ""}`);
  },
  // TBB-65: динамический каталог удобств отеля.
  publicAmenityOptions: (section) =>
    call("GET", `/public/amenity-options?section=${encodeURIComponent(section)}`),
  publicHotels: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== "" && v != null) qs.set(k, v);
    }
    return call("GET", "/public/hotels" + (qs.toString() ? "?" + qs : ""));
  },
  createBooking: (payload) => call("POST", "/c/bookings", payload),
  myBookingsAtHotel: (hid) => call("GET", `/c/bookings?hotel_id=${hid}`),
  myBookings: () => call("GET", "/c/bookings"),
  getBooking: (code) => call("GET", `/c/bookings/${code}`),
  getBookingMedia: (code) => call("GET", `/c/bookings/${code}/media`),
  cancelMyBooking: (code) => call("POST", `/c/bookings/${code}/cancel`),
  requestCancellation: (code, reasons, note) =>
    call("POST", `/c/bookings/${code}/cancellation-request`, {
      reasons,
      note: note || null,
    }),
  payInit: (code) => call("POST", `/c/bookings/${code}/pay/init`),
};
