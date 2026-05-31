// Hash-router с поддержкой блочных вложенных маршрутов и query-params.
// Поддерживает паттерны:
//   "/"               — точное совпадение.
//   "/client/*"       — wildcard, всё что после `/client/` уходит в params.rest.
//   "/client/hotel/{id}" — именованный параметр.

import { hideBack } from "./topbar.js";

const routes = [];

export function route(pattern, handler) {
  let regex;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    regex = new RegExp("^" + escapeRe(prefix) + "(/.*)?$");
    routes.push({ regex, handler, kind: "wildcard" });
  } else {
    const r = pattern
      .split("/")
      .map((seg) => seg.replace(/\{(\w+)\}/g, "(?<$1>[^/]+)"))
      .join("/");
    regex = new RegExp("^" + r + "$");
    routes.push({ regex, handler, kind: "exact" });
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function navigate(hash) {
  const target = hash.startsWith("#") ? hash : "#" + hash;
  if (location.hash === target) {
    run();
  } else {
    location.hash = target;
  }
}

function isTgInternalHash(raw) {
  return raw.startsWith("tgWebApp");
}

export function getQuery() {
  const raw = location.hash.replace(/^#/, "");
  if (isTgInternalHash(raw)) return {};
  const q = raw.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export function currentPath() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw || isTgInternalHash(raw)) return "/";
  return raw.split("?")[0];
}

export async function run() {
  // Сброс per-view UI: back-кнопка, bottom-nav, owner-selector скрыты по
  // умолчанию; view/блок сам(а) их включит, если нужно. hideBack снимает
  // и в-app кнопку, и TG WebApp BackButton (offClick + hide).
  hideBack();
  const bn = document.getElementById("bottomnav");
  if (bn) bn.hidden = true;
  const fb = document.getElementById("filterbar");
  if (fb) { fb.hidden = true; fb.innerHTML = ""; }
  const os = document.getElementById("owner-selector");
  if (os) os.hidden = true;

  const path = currentPath();
  const query = getQuery();
  for (const { regex, handler, kind } of routes) {
    const m = path.match(regex);
    if (!m) continue;
    const params = { ...(m.groups || {}), _query: query };
    if (kind === "wildcard") params.rest = m[1] || "";
    try {
      await handler(params);
    } catch (e) {
      console.error("Route handler error:", e);
      document.getElementById("app").innerHTML =
        `<div class="error">${escapeHtml(e.message || String(e))}</div>`;
    }
    return;
  }
  document.getElementById("app").textContent = "404: " + path;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function initRouter() {
  window.addEventListener("hashchange", run);
}
