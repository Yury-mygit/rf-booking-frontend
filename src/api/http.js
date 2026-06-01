// HTTP-обёртки для JSON и multipart. Centralизованный error-mapping:
// все non-OK ответы → throw Error с `.code` и `.status`, плюс
// CustomEvent "apierror" для блоков, которые реагируют на конкретные
// бизнес-ошибки (напр. partner_pending → переход на waiting screen).

import { state } from "./state.js";

export const BASE = "/api/v1";

export async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (r.status === 204) return null;
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

export async function callMultipart(method, path, formData) {
  const headers = {};
  if (state.token()) headers.Authorization = `Bearer ${state.token()}`;
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
