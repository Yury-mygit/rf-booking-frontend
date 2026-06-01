// Chat — обе стороны (client и partner). EventSource создаётся здесь
// потому что fetch не подходит для SSE; токен пробрасывается query'ём
// т.к. EventSource не поддерживает Authorization header.

import { BASE, call } from "./http.js";
import { state } from "./state.js";

export const chat = {
  // ─── Client-side ───────────────────────────────────────────────────────
  chatOpenThread: (hotelId, subject) =>
    call("POST", "/c/chat/threads/open", {
      hotel_id: hotelId,
      subject_type: subject?.type ?? null,
      subject_id: subject?.id ?? null,
    }),
  chatListThreads: () => call("GET", "/c/chat/threads"),
  chatListMessages: (threadId, cursor = null, limit = 50) => {
    const qs = new URLSearchParams();
    if (cursor != null) qs.set("cursor", cursor);
    qs.set("limit", String(limit));
    return call("GET", `/c/chat/threads/${threadId}/messages?${qs}`);
  },
  chatSendMessage: (threadId, body, subject) =>
    call("POST", `/c/chat/threads/${threadId}/messages`, {
      body,
      subject_type: subject?.type ?? null,
      subject_id: subject?.id ?? null,
    }),
  chatMarkRead: (threadId) =>
    call("POST", `/c/chat/threads/${threadId}/read`),
  chatEventSource: () =>
    new EventSource(BASE + "/c/chat/events?token=" + encodeURIComponent(state.token())),

  // ─── Partner-side ──────────────────────────────────────────────────────
  partnerChatGetThread: (clientId, hotelId) =>
    call("GET", `/p/clients/${clientId}/chat?hotel_id=${hotelId}`),
  partnerChatListMessages: (clientId, hotelId, cursor = null, limit = 50) => {
    const qs = new URLSearchParams();
    qs.set("hotel_id", String(hotelId));
    if (cursor != null) qs.set("cursor", cursor);
    qs.set("limit", String(limit));
    return call("GET", `/p/clients/${clientId}/chat/messages?${qs}`);
  },
  partnerChatSendMessage: (clientId, hotelId, body, subject) =>
    call("POST", `/p/clients/${clientId}/chat/messages?hotel_id=${hotelId}`, {
      body,
      subject_type: subject?.type ?? null,
      subject_id: subject?.id ?? null,
    }),
  partnerChatMarkRead: (clientId, hotelId) =>
    call("POST", `/p/clients/${clientId}/chat/read?hotel_id=${hotelId}`),
  partnerChatEventSource: () =>
    new EventSource(BASE + "/p/chat/events?token=" + encodeURIComponent(state.token())),
};
