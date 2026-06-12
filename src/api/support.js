// Support chat API wrappers (карта #92).
//
// User-side  /api/v1/support/*
// Admin-side /api/v1/admin/support/*

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
  getMyThread: (block) => call("GET", "/support/thread" + qs({ block })),
  getMyMessages: (params) =>
    call("GET", "/support/thread/messages" + qs(params)),
  sendMyMessage: (body) => call("POST", "/support/thread/messages", body),
  markMyRead: (body) => call("POST", "/support/thread/read", body),
  userEventsUrl: (block) =>
    BASE + "/support/events/sse" + qs({ block }),

  // ─── admin-side ───────────────────────────────────────────────────
  adminListThreads: (params) =>
    call("GET", "/admin/support/threads" + qs(params)),
  adminGetThread: (id) => call("GET", `/admin/support/threads/${id}`),
  adminGetMessages: (id, params) =>
    call("GET", `/admin/support/threads/${id}/messages` + qs(params)),
  adminSendMessage: (id, body) =>
    call("POST", `/admin/support/threads/${id}/messages`, body),
  adminMarkRead: (id, body) =>
    call("POST", `/admin/support/threads/${id}/read`, body),
  adminEventsUrl: () => BASE + "/admin/support/events/sse",
};
