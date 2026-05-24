// Единый API client. Variant B: токен один, никакого `requested_role`.
// Authentication говорит «ты юзер N», authorization — забота endpoint'ов.

const BASE = "/api/v1";

let _token = localStorage.getItem("rfbook_token") || "";
let _user = JSON.parse(localStorage.getItem("rfbook_user") || "null");

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
    throw err;
  }
  return data;
}

export const api = {
  hasToken: () => !!_token,
  user: () => _user,
  authToken: () => _token,
  setSession(token, user) {
    _token = token;
    _user = user;
    localStorage.setItem("rfbook_token", token);
    if (user) localStorage.setItem("rfbook_user", JSON.stringify(user));
  },
  clearSession() {
    _token = "";
    _user = null;
    localStorage.removeItem("rfbook_token");
    localStorage.removeItem("rfbook_user");
  },

  // Auth (NB: backend в variant B игнорирует requested_role; держим как
  // necessary параметр для совместимости пока endpoint не поправили).
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

  // ─── Client (/c/*, public) ──────────────────────────────────────────────
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

  // ─── Partner (/p/*) и Admin (/admin/*) endpoints добавляются по мере
  // переноса views в Этапах 5-6. Здесь не дублируем 50+ методов
  // преждевременно — добавляем когда нужно конкретному view.
};
