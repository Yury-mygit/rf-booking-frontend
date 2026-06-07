// Общие утилиты, используемые view'хами разных блоков.

// Превращает media-asset URL в URL миниатюры (256×256 webp).
// Для legacy/non-media URL (пустой или `/api/v1/photos/…` — таких после
// миграции 2026-06-07 в DB не должно быть, но на всякий случай) — возвращает
// как есть. См. карту `booking → media migration`, Stage 6.
export function assetThumbUrl(url) {
  if (!url) return "";
  if (/\/api\/v1\/assets\/[0-9a-f-]{36}$/i.test(url)) {
    return url + "/thumb";
  }
  return url;
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

export function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoDay(d) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
}

export function relativeTime(value, t) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return t("time.just_now");
  if (diff < 3600) return t("time.minutes_ago", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("time.hours_ago", { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 30) return t("time.days_ago", { n: Math.floor(diff / 86400) });
  if (diff < 86400 * 365)
    return t("time.months_ago", { n: Math.floor(diff / (86400 * 30)) });
  return t("time.years_ago", { n: Math.floor(diff / (86400 * 365)) });
}
