// HTTP-обёртки для JSON и multipart. Centralизованный error-mapping:
// все non-OK ответы → throw Error с `.code` и `.status`, плюс
// CustomEvent "apierror" для блоков, которые реагируют на конкретные
// бизнес-ошибки (напр. partner_pending → переход на waiting screen).

import { state } from "./state.js";

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

export async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = apiError(r, data);
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}

export async function callMultipart(method, path, formData) {
  const headers = {};
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
  const r = await fetch(BASE + path, { method, headers, body: formData });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = apiError(r, data);
    window.dispatchEvent(new CustomEvent("apierror", { detail: err }));
    throw err;
  }
  return data;
}
