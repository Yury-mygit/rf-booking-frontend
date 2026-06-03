// Support Ticketing API wrappers.
//
// Карта: open_cards/cards/booking/feature/2026-06-02-support-ticketing-system.md
//   - User-side  /api/v1/support/*
//   - Admin-side /api/v1/admin/support/*
//
// SSE URL'ы возвращаем как полные пути (для EventSource).

import { BASE, call } from "./http.js";

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, v);
  }
  const s = u.toString();
  return s ? "?" + s : "";
}

export const support = {
  // ─── user-side ────────────────────────────────────────────────────
  listCategories: () => call("GET", "/support/categories"),
  createTicket: (body) => call("POST", "/support/tickets", body),
  listMyTickets: (params) => call("GET", "/support/tickets" + qs(params)),
  getMyTicket: (number) => call("GET", `/support/tickets/${number}`),
  sendMessage: (number, body) =>
    call("POST", `/support/tickets/${number}/messages`, body),
  markRead: (number) => call("POST", `/support/tickets/${number}/read`),
  userEventsUrl: () => BASE + "/support/events/sse",

  // ─── admin-side: tickets ─────────────────────────────────────────
  adminListTickets: (params) => call("GET", "/admin/support/tickets" + qs(params)),
  adminGetTicket: (number) => call("GET", `/admin/support/tickets/${number}`),
  adminCreateTicket: (body) => call("POST", "/admin/support/tickets", body),
  adminSendMessage: (number, body) =>
    call("POST", `/admin/support/tickets/${number}/messages`, body),
  adminMarkRead: (number) => call("POST", `/admin/support/tickets/${number}/read`),
  adminPatchTicket: (number, body) =>
    call("PATCH", `/admin/support/tickets/${number}`, body),
  adminClaim: (number) =>
    call("POST", `/admin/support/tickets/${number}/assignee/me`),
  adminRelease: (number) =>
    call("POST", `/admin/support/tickets/${number}/assignee/clear`),
  adminAddTag: (number, tag_id) =>
    call("POST", `/admin/support/tickets/${number}/tags`, { tag_id }),
  adminRemoveTag: (number, tag_id) =>
    call("DELETE", `/admin/support/tickets/${number}/tags/${tag_id}`),
  adminListEvents: (number) =>
    call("GET", `/admin/support/tickets/${number}/events`),
  adminEventsUrl: () => BASE + "/admin/support/events/sse",

  // ─── admin-side: roster ──────────────────────────────────────────
  adminListAgents: (include_removed = false) =>
    call("GET", "/admin/support/agents" + qs({ include_removed })),
  adminAddAgent: (body) => call("POST", "/admin/support/agents", body),
  adminPatchAgent: (id, body) =>
    call("PATCH", `/admin/support/agents/${id}`, body),
  adminRemoveAgent: (id) => call("DELETE", `/admin/support/agents/${id}`),
  adminUsersSearch: (q, limit = 20) =>
    call("GET", "/admin/support/users/search" + qs({ q, limit })),

  // ─── admin-side: tags ────────────────────────────────────────────
  adminListTags: () => call("GET", "/admin/support/tags"),
  adminCreateTag: (body) => call("POST", "/admin/support/tags", body),
  adminPatchTag: (id, body) => call("PATCH", `/admin/support/tags/${id}`, body),
  adminDeleteTag: (id) => call("DELETE", `/admin/support/tags/${id}`),

  // ─── admin-side: categories ──────────────────────────────────────
  adminListCategories: () => call("GET", "/admin/support/categories"),
  adminCreateCategory: (body) => call("POST", "/admin/support/categories", body),
  adminPatchCategory: (id, body) =>
    call("PATCH", `/admin/support/categories/${id}`, body),
  adminDeleteCategory: (id) =>
    call("DELETE", `/admin/support/categories/${id}`),

  // ─── admin-side: settings ────────────────────────────────────────
  adminGetSettings: () => call("GET", "/admin/support/settings"),
  adminPatchSettings: (body) => call("PATCH", "/admin/support/settings", body),

  // ─── admin-side: canned ──────────────────────────────────────────
  adminListCanned: (params) => call("GET", "/admin/support/canned" + qs(params)),
  adminCreateCanned: (body) => call("POST", "/admin/support/canned", body),
  adminPatchCanned: (id, body) =>
    call("PATCH", `/admin/support/canned/${id}`, body),
  adminDeleteCanned: (id) => call("DELETE", `/admin/support/canned/${id}`),
  adminUseCanned: (id) => call("POST", `/admin/support/canned/${id}/use`),
};
