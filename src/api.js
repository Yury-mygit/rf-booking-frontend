// Единый API client. Variant B: токен один, никакого `requested_role`.
// Authentication говорит «ты юзер N», authorization — забота endpoint'ов.
//
// State, кроме токена и user, держим accessibleOwners + активный owner для
// partner-блока — partner UI и /p/* endpoints используют это как scope.

const BASE = "/api/v1";

let _token = localStorage.getItem("rfbook_token") || "";
let _user = JSON.parse(localStorage.getItem("rfbook_user") || "null");
let _accessibleOwners = JSON.parse(localStorage.getItem("rfbook_accessible_owners") || "[]");
let _activeOwnerId = (() => {
  const raw = localStorage.getItem("rfbook_active_owner_id");
  return raw ? Number(raw) : null;
})();

async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (_token) headers.Authorization = `Bearer ${_token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || r.statusText);
    err.code = data.error || "http_error";
    err.status = r.status;
    // Notify blocks that need to react to specific business errors
    // (e.g. partner_pending → switch to waiting screen).
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}

async function callMultipart(method, path, formData) {
  const headers = {};
  if (_token) headers.Authorization = `Bearer ${_token}`;
  const r = await fetch(BASE + path, { method, headers, body: formData });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || r.statusText);
    err.code = data.error || "http_error";
    err.status = r.status;
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}

export const api = {
  // ─── Session ───────────────────────────────────────────────────────────
  hasToken: () => !!_token,
  user: () => _user,
  authToken: () => _token,
  setSession(token, user, accessibleOwners) {
    _token = token;
    _user = user;
    localStorage.setItem("rfbook_token", token);
    if (user) localStorage.setItem("rfbook_user", JSON.stringify(user));
    if (accessibleOwners !== undefined) {
      _accessibleOwners = accessibleOwners || [];
      localStorage.setItem("rfbook_accessible_owners", JSON.stringify(_accessibleOwners));
      // reset selector if previously selected owner is no longer accessible
      if (
        _activeOwnerId &&
        !_accessibleOwners.some((o) => o.owner_user_id === _activeOwnerId)
      ) {
        _activeOwnerId = null;
        localStorage.removeItem("rfbook_active_owner_id");
      }
    }
  },
  adoptToken(token) {
    _token = token;
    localStorage.setItem("rfbook_token", token);
  },
  clearSession() {
    _token = "";
    _user = null;
    _accessibleOwners = [];
    _activeOwnerId = null;
    localStorage.removeItem("rfbook_token");
    localStorage.removeItem("rfbook_user");
    localStorage.removeItem("rfbook_accessible_owners");
    localStorage.removeItem("rfbook_active_owner_id");
  },

  // ─── Partner ownership scope (for /p/* endpoints) ─────────────────────
  owners: () => _accessibleOwners,
  activeOwnerId: () => {
    if (_accessibleOwners.length === 0) return null;
    if (_activeOwnerId && _accessibleOwners.some((o) => o.owner_user_id === _activeOwnerId)) {
      return _activeOwnerId;
    }
    return _accessibleOwners[0].owner_user_id;
  },
  setActiveOwnerId(id) {
    _activeOwnerId = id;
    if (id) localStorage.setItem("rfbook_active_owner_id", String(id));
    else localStorage.removeItem("rfbook_active_owner_id");
    window.dispatchEvent(new CustomEvent("ownerchange"));
  },
  canDo(perm, ownerId) {
    const oid = ownerId ?? api.activeOwnerId();
    if (!oid) return false;
    const o = _accessibleOwners.find((x) => x.owner_user_id === oid);
    return !!(o && o.perms && o.perms[perm]);
  },

  // ─── Auth ──────────────────────────────────────────────────────────────
  authTg: (initData) => call("POST", "/auth/tg", { init_data: initData }),
  whoami: () => call("GET", "/auth/whoami"),
  authDev: (tgId, name, role = "client") => {
    const qs = new URLSearchParams({
      telegram_id: String(tgId),
      first_name: name,
      role,
    });
    return call("POST", `/auth/dev-login?${qs}`);
  },

  // ─── Client (/c/*, public) ─────────────────────────────────────────────
  hotelDetails(id, params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== "" && v != null) qs.set(k, v);
    }
    return call("GET", `/public/hotels/${id}${qs.toString() ? "?" + qs : ""}`);
  },
  createBooking: (payload) => call("POST", "/c/bookings", payload),
  myBookingsAtHotel: (hid) => call("GET", `/c/bookings?hotel_id=${hid}`),
  getBooking: (code) => call("GET", `/c/bookings/${code}`),
  payInit: (code) => call("POST", `/c/bookings/${code}/pay/init`),
  payConfirm: (paymentId) => call("POST", `/c/payments/${paymentId}/mock-confirm`),

  // ─── Partner (/p/*) ────────────────────────────────────────────────────
  // Hotels
  listHotels: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? api.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/hotels" + (s ? `?${s}` : ""));
  },
  getHotel: (id) => call("GET", `/p/hotels/${id}`),
  getHotelDashboard: (id) => call("GET", `/p/hotels/${id}/dashboard`),
  createHotel: (payload) => call("POST", "/p/hotels", payload),
  updateHotel: (id, payload) => call("PUT", `/p/hotels/${id}`, payload),
  deleteHotel: (id) => call("DELETE", `/p/hotels/${id}`),

  // Rooms
  listRooms: (hid) => call("GET", `/p/hotels/${hid}/rooms`),
  getRoom: (hid, rid) => call("GET", `/p/hotels/${hid}/rooms/${rid}`),
  createRoom: (hid, payload) => call("POST", `/p/hotels/${hid}/rooms`, payload),
  updateRoom: (hid, rid, payload) => call("PUT", `/p/hotels/${hid}/rooms/${rid}`, payload),
  deleteRoom: (hid, rid) => call("DELETE", `/p/hotels/${hid}/rooms/${rid}`),

  // Availability
  getAvailability: (hid, rid, from, to) =>
    call("GET", `/p/hotels/${hid}/rooms/${rid}/availability?from=${from}&to=${to}`),
  updateAvailability: (hid, rid, nights) =>
    call("PUT", `/p/hotels/${hid}/rooms/${rid}/availability`, { nights }),

  // Photos — hotel
  uploadPhoto(hid, file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", `/p/hotels/${hid}/photos`, fd);
  },
  deletePhoto: (hid, url) =>
    call("DELETE", `/p/hotels/${hid}/photos?url=${encodeURIComponent(url)}`),
  reorderPhotos: (hid, urls) =>
    call("PUT", `/p/hotels/${hid}/photos/reorder`, { urls }),

  // Photos — room
  uploadRoomPhoto(rid, file) {
    const fd = new FormData();
    fd.append("file", file);
    return callMultipart("POST", `/p/rooms/${rid}/photos`, fd);
  },
  deleteRoomPhoto: (rid, url) =>
    call("DELETE", `/p/rooms/${rid}/photos?url=${encodeURIComponent(url)}`),
  reorderRoomPhotos: (rid, urls) =>
    call("PUT", `/p/rooms/${rid}/photos/reorder`, { urls }),

  // Bookings (partner-side)
  listBookings: (statusFilter, opts = {}) => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (opts.hotelId) qs.set("hotel_id", opts.hotelId);
    if (opts.limit) qs.set("limit", opts.limit);
    const ownerId = opts.ownerId !== undefined ? opts.ownerId : (opts.hotelId ? null : api.activeOwnerId());
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/bookings" + (s ? `?${s}` : ""));
  },
  confirmBooking: (code) => call("POST", `/p/bookings/${code}/confirm`),
  markPaid: (code) => call("POST", `/p/bookings/${code}/mark-paid`),
  cancelBooking: (code) => call("POST", `/p/bookings/${code}/cancel`),
  setPostpay: (code, postpay) => call("POST", `/p/bookings/${code}/postpay`, { postpay }),

  // Walk-in
  createWalkinBooking: (payload) => call("POST", "/p/walkin-bookings", payload),

  // Flat rooms (across all my hotels)
  listAllRooms: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? api.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/rooms" + (s ? `?${s}` : ""));
  },

  // Clients
  listClients: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? api.activeOwnerId();
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

  // Staff
  listStaff: (opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? api.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("GET", "/p/staff" + (s ? `?${s}` : ""));
  },
  addStaff: (payload, opts = {}) => {
    const qs = new URLSearchParams();
    const ownerId = opts.ownerId ?? api.activeOwnerId();
    if (ownerId) qs.set("owner_id", ownerId);
    const s = qs.toString();
    return call("POST", "/p/staff" + (s ? `?${s}` : ""), payload);
  },
  updateStaff: (id, payload) => call("PUT", `/p/staff/${id}`, payload),
  removeStaff: (id) => call("DELETE", `/p/staff/${id}`),

  // Staff invites
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

  // Audit
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
    if (_token) headers.Authorization = `Bearer ${_token}`;
    const r = await fetch(BASE + "/p/audit.csv" + (qs.toString() ? `?${qs}` : ""), { headers });
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

function _auditQs(opts) {
  const qs = new URLSearchParams();
  const ownerId = opts.ownerId ?? api.activeOwnerId();
  if (ownerId) qs.set("owner_id", ownerId);
  if (opts.action) qs.set("action", opts.action);
  if (opts.subjectType) qs.set("subject_type", opts.subjectType);
  if (opts.since) qs.set("since", opts.since);
  if (opts.until) qs.set("until", opts.until);
  if (opts.q) qs.set("q", opts.q);
  if (opts.actorUserId) qs.set("actor_user_id", opts.actorUserId);
  return qs;
}
