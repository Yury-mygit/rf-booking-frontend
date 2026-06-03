// Единый API client. Variant B: токен один, никакого `requested_role`.
// Authentication говорит «ты юзер N», authorization — забота endpoint'ов.
//
// State + методы разнесены в src/api/* (см. карту #49 этап 2, 2026-06-01).
// Этот файл — aggregator, экспортирует один `api` namespace для всех 43
// callers — менять их не пришлось.

import { state } from "./api/state.js";
import { auth } from "./api/auth.js";
import { client } from "./api/client.js";
import { partner } from "./api/partner.js";
import { qr } from "./api/qr.js";
import { admin } from "./api/admin.js";
import { chat } from "./api/chat.js";
import { support } from "./api/support.js";

export const api = {
  // ─── Session ───────────────────────────────────────────────────────────
  hasToken: () => !!state.token(),
  user: () => state.user(),
  authToken: () => state.token(),
  setSession: (...args) => state.setSession(...args),
  adoptToken: (token) => state.setToken(token),
  clearSession: () => state.clear(),

  // ─── Partner ownership scope (for /p/* endpoints) ─────────────────────
  owners: () => state.accessibleOwners(),
  activeOwnerId: () => state.activeOwnerId(),
  setActiveOwnerId: (id) => state.setActiveOwnerId(id),
  canDo: (perm, ownerId) => state.canDo(perm, ownerId),

  // ─── Per-domain methods ────────────────────────────────────────────────
  ...auth,
  ...client,
  ...partner,
  ...qr,
  ...admin,
  ...chat,
  ...support,
};
