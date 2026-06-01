// Admin endpoints: /admin/* (require_role admin).

import { call } from "./http.js";

export const admin = {
  adminMetrics: () => call("GET", "/admin/metrics"),
  adminListUsers(filters = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== "" && v != null) qs.set(k, v);
    }
    return call("GET", `/admin/users${qs.toString() ? "?" + qs : ""}`);
  },
  adminVerifyPartner(userId, companyName, legalInn) {
    const qs = new URLSearchParams({ company_name: companyName });
    if (legalInn) qs.set("legal_inn", legalInn);
    return call("POST", `/admin/users/${userId}/verify-partner?${qs}`);
  },
  adminRevokePartner: (userId) => call("POST", `/admin/users/${userId}/revoke-partner`),
  adminPromoteAdmin: (userId) => call("POST", `/admin/users/${userId}/promote-admin`),
  adminDemoteAdmin: (userId) => call("POST", `/admin/users/${userId}/demote-admin`),
  adminListHotels(status) {
    return call("GET", `/admin/hotels${status ? "?status=" + status : ""}`);
  },
  adminSetHotelStatus: (hotelId, status) =>
    call("PUT", `/admin/hotels/${hotelId}/status`, { status }),
  adminListBookings(filters = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== "" && v != null) qs.set(k, v);
    }
    return call("GET", `/admin/bookings${qs.toString() ? "?" + qs : ""}`);
  },
  adminCancelBooking: (code) => call("POST", `/admin/bookings/${code}/cancel`),
};
