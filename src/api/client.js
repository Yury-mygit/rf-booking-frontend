// Client-side endpoints: /c/* (auth required) + /public/* (anonymous).

import { call } from "./http.js";

export const client = {
  hotelDetails(id, params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== "" && v != null) qs.set(k, v);
    }
    return call("GET", `/public/hotels/${id}${qs.toString() ? "?" + qs : ""}`);
  },
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
  payInit: (code) => call("POST", `/c/bookings/${code}/pay/init`),
  payConfirm: (paymentId) => call("POST", `/c/payments/${paymentId}/mock-confirm`),
};
