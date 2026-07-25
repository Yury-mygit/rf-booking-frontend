// Partner endpoints: /p/*. Все методы, требующие `owner_id`-scope,
// читают `state.activeOwnerId()` если caller не передал `opts.ownerId`.

import { BASE, call, callMultipart } from "./http.js";
import { state } from "./state.js";

function _auditQs(opts) {
  const qs = new URLSearchParams();
  const ownerId = opts.ownerId ?? state.activeOwnerId();
  if (ownerId) qs.set("owner_id", ownerId);
  if (opts.action) qs.set("action", opts.action);
  if (opts.subjectType) qs.set("subject_type", opts.subjectType);
  if (opts.since) qs.set("since", opts.since);
  if (opts.until) qs.set("until", opts.until);
  if (opts.q) qs.set("q", opts.q);
  if (opts.actorUserId) qs.set("actor_user_id", opts.actorUserId);
  return qs;
}

export const partner = {
  // ─── Hotels ────────────────────────────────────────────────────────────
  listHotels: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/hotels" + (s ? `?${s}` : ""));
  },
  getHotel: (id) => call("GET", `/p/hotels/${id}`),
  getHotelDashboard: (id) => call("GET", `/p/hotels/${id}/dashboard`),
  createHotel: (payload) => call("POST", "/p/hotels", payload),
  updateHotel: (id, payload) => call("PUT", `/p/hotels/${id}`, payload),
  deleteHotel: (id) => call("DELETE", `/p/hotels/${id}`),
  shareHotelToSelf: (id) => call("POST", `/p/hotels/${id}/share-to-self`),

  // ─── Rooms ─────────────────────────────────────────────────────────────
  listRooms: (hid) => call("GET", `/p/hotels/${hid}/rooms`),
  getRoom: (hid, rid) => call("GET", `/p/hotels/${hid}/rooms/${rid}`),
  createRoom: (hid, payload) => call("POST", `/p/hotels/${hid}/rooms`, payload),
  updateRoom: (hid, rid, payload) => call("PUT", `/p/hotels/${hid}/rooms/${rid}`, payload),
  setRoomStatus: (rid, status) => call("PUT", `/p/rooms/${rid}/status`, { status }),
  deleteRoom: (hid, rid) => call("DELETE", `/p/hotels/${hid}/rooms/${rid}`),

  // ─── Availability ──────────────────────────────────────────────────────
  getAvailability: (hid, rid, from, to) =>
    call("GET", `/p/hotels/${hid}/rooms/${rid}/availability?from=${from}&to=${to}`),
  updateAvailability: (hid, rid, nights) =>
    call("PUT", `/p/hotels/${hid}/rooms/${rid}/availability`, { nights }),

  // ─── Photos — hotel ────────────────────────────────────────────────────
  uploadPhoto(hid, file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", `/p/hotels/${hid}/photos`, fd);
  },
  deletePhoto: (hid, url) =>
    call("DELETE", `/p/hotels/${hid}/photos?url=${encodeURIComponent(url)}`),
  reorderPhotos: (hid, urls) =>
    call("PUT", `/p/hotels/${hid}/photos/reorder`, { urls }),

  // ─── Photos — room ─────────────────────────────────────────────────────
  uploadRoomPhoto(rid, file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", `/p/rooms/${rid}/photos`, fd);
  },
  deleteRoomPhoto: (rid, url) =>
    call("DELETE", `/p/rooms/${rid}/photos?url=${encodeURIComponent(url)}`),
  reorderRoomPhotos: (rid, urls) =>
    call("PUT", `/p/rooms/${rid}/photos/reorder`, { urls }),

  // ─── Bookings (partner-side) ───────────────────────────────────────────
  listBookings: (statusFilter, opts = {}) => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (opts.hotelId) qs.set("hotel_id", opts.hotelId);
    if (opts.limit) qs.set("limit", opts.limit);
    const ownerId =
      opts.ownerId !== undefined
        ? opts.ownerId
        : opts.hotelId
          ? null
          : state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/bookings" + (s ? `?${s}` : ""));
  },
  confirmBooking: (code) => call("POST", `/p/bookings/${code}/confirm`),
  cancelBooking: (code) => call("POST", `/p/bookings/${code}/cancel`),

  // ─── Flat rooms (across all my hotels) ─────────────────────────────────
  listAllRooms: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/rooms" + (s ? `?${s}` : ""));
  },

  // ─── Clients ───────────────────────────────────────────────────────────
  listClients: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/clients" + (s ? `?${s}` : ""));
  },
  getClient: (id) => call("GET", `/p/clients/${id}`),
  updateClient: (id, payload) => call("PUT", `/p/clients/${id}`, payload),
  listClientBookings: (id) => call("GET", `/p/clients/${id}/bookings`),
  lookupClient: (payload) => call("POST", "/p/clients/lookup", payload),
  uploadClientPhoto(id, file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", `/p/clients/${id}/photo`, fd);
  },
  deleteClientPhoto: (id) => call("DELETE", `/p/clients/${id}/photo`),

  // ─── Roles (должности) ────────────────────────────────────────────────
  listRoles: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/roles" + (s ? `?${s}` : ""));
  },
  createRole: (payload, opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("POST", "/p/roles" + (s ? `?${s}` : ""), payload);
  },
  updateRole: (id, payload) => call("PATCH", `/p/roles/${id}`, payload),
  deleteRole: (id) => call("DELETE", `/p/roles/${id}`),

  // ─── Staff ─────────────────────────────────────────────────────────────
  listStaff: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/staff" + (s ? `?${s}` : ""));
  },
  addStaff: (payload, opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? state.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("POST", "/p/staff" + (s ? `?${s}` : ""), payload);
  },
  updateStaff: (id, payload) => call("PUT", `/p/staff/${id}`, payload),
  removeStaff: (id) => call("DELETE", `/p/staff/${id}`),

  // ─── Staff invites (deep-link через бот) ───────────────────────────────
  createStaffInvite: (payload, ownerId) => {
    const qs = new URLSearchParams();
    if (ownerId != null) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("POST", "/p/staff/invites" + (s ? `?${s}` : ""), payload);
  },
  listStaffInvites: (ownerId) => {
    const qs = new URLSearchParams();
    if (ownerId != null) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/staff/invites" + (s ? `?${s}` : ""));
  },
  revokeStaffInvite: (id) => call("DELETE", `/p/staff/invites/${id}`),
  acceptStaffInvite: (token) => call("POST", "/p/staff/invite/accept", { token }),

  // ─── Audit ─────────────────────────────────────────────────────────────
  listAudit: (opts = {}) => {
    const qs = _auditQs(opts);
    if (opts.limit) qs.set("limit", opts.limit);
    if (opts.offset) qs.set("offset", opts.offset);
    const s = qs.toString();
    return call("GET", "/p/audit" + (s ? `?${s}` : ""));
  },
  async downloadAuditCsv(opts = {}) {
    const qs = _auditQs(opts);
    const headers = {};
    if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
    const r = await fetch(
      BASE + "/p/audit.csv" + (qs.toString() ? `?${qs}` : ""),
      { headers },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `audit-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
