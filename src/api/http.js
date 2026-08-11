// HTTP-обёртки для JSON и multipart. Centralизованный error-mapping:
// все non-OK ответы → throw Error с `.code` и `.status`, плюс
// CustomEvent "apierror" для блоков, которые реагируют на конкретные
// бизнес-ошибки (напр. partner_pending → переход на waiting screen).
//
// Auto-recovery на 401 token_expired (TBB-50): если запрос упал с
// истёкшей сессией и мы внутри TG с валидным initData — один раз
// молча пере-минтим token через /auth/tg и retry'нем исходный запрос.
// Single-flight guard: N параллельных 401 → один re-auth. Один retry
// per-request (флаг `_retried`) — не крутим цикл, если и re-auth
// не помог (например, TG отдал stale initData).

import { state } from "./state.js";
import { tg, inTelegram } from "../tg.js";

export const BASE = "/api/v1";

function validationMessage(detail) {
  if (!Array.isArray(detail)) return null;
  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const loc = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";
      const message = typeof item.msg === "string" ? item.msg.trim() : "";
      if (!loc && !message) return null;
      return loc && message ? `${loc}: ${message}` : loc || message;
    })
    .filter(Boolean);
  return messages.length ? messages.join("; ") : null;
}

function apiError(response, data) {
  const message =
    (typeof data.message === "string" && data.message.trim()) ||
    validationMessage(data.detail) ||
    (response.statusText && response.statusText.trim()) ||
    `HTTP ${response.status}`;
  const err = new Error(message);
  err.code = data.error || "http_error";
  err.status = response.status;
  if (data.detail !== undefined) err.detail = data.detail;
  return err;
}

// Single-flight cache для re-auth. Пока promise висит, все параллельные
// вызовы ждут его. finally сбрасывает — следующий 401 сможет начать
// новую попытку (например если через минуту юзер снова активен, initData
// может стать свежим).
let _reAuthPromise = null;

async function _mintFreshSession() {
  if (!inTelegram || !tg?.initData) {
    throw new Error("no_init_data");
  }
  const r = await fetch(BASE + "/auth/tg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: tg.initData }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(r, data);
  state.setSession(data.token, data.user, data.accessible_owners);
}

function reAuthOnce() {
  if (!_reAuthPromise) {
    _reAuthPromise = _mintFreshSession().finally(() => {
      _reAuthPromise = null;
    });
  }
  return _reAuthPromise;
}

// Пытается автоматически восстановить сессию при 401 token_expired.
// Возвращает true если получилось (call можно retry'нуть). При провале
// re-auth — чистит state (γ подхватит session_stale) и возвращает false.
async function tryRecoverSession() {
  if (!inTelegram || !tg?.initData) return false;
  try {
    await reAuthOnce();
    return true;
  } catch (_reAuthErr) {
    state.clear();
    return false;
  }
}

export async function call(method, path, body, _opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = apiError(r, data);
    if (err.status === 401 && err.code === "token_expired" && !_opts._retried) {
      if (await tryRecoverSession()) {
        return call(method, path, body, { _retried: true });
      }
    }
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}

export async function callMultipart(method, path, formData, _opts = {}) {
  const headers = {};
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
  const r = await fetch(BASE + path, { method, headers, body: formData });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = apiError(r, data);
    if (err.status === 401 && err.code === "token_expired" && !_opts._retried) {
      if (await tryRecoverSession()) {
        return callMultipart(method, path, formData, { _retried: true });
      }
    }
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}
