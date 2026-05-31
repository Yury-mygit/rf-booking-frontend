// Чистые date-utils для календаря: ISO ↔ Date, грид месяца Monday-first,
// форматирование месяца/недели через Intl. Без DOM-зависимостей.

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function todayISO() {
  return toISO(new Date());
}

export function fmtShort(iso, lang) {
  if (!iso) return "";
  const d = fromISO(iso);
  return new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short" }).format(d);
}

export function fmtMonthTitle(d, lang) {
  return new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(d);
}

export function weekdayShortNames(lang) {
  // Monday-first. Use a known Monday as anchor (2024-01-01).
  const monday = new Date(2024, 0, 1);
  const fmt = new Intl.DateTimeFormat(lang, { weekday: "short" });
  const names = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    names.push(fmt.format(d));
  }
  return names;
}

export function buildMonthGrid(monthAnchor) {
  // 42 ячейки (6 недель × 7), Monday-first.
  const first = startOfMonth(monthAnchor);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - offset + i);
    cells.push(d);
  }
  return cells;
}

// Форматирование одиночной/диапазона дат для поля «Даты». Возвращает
// строку для отображения, без префиксов («10 окт», «10–15 окт»,
// «10 окт – 5 нояб»).
export function fmtDatesField(checkIn, checkOut, lang) {
  if (!checkIn && !checkOut) return "";
  if (checkIn && !checkOut) return fmtShort(checkIn, lang);
  const a = fromISO(checkIn);
  const b = fromISO(checkOut);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    const monthShort = new Intl.DateTimeFormat(lang, { month: "short" }).format(a);
    return `${a.getDate()}–${b.getDate()} ${monthShort}`;
  }
  return `${fmtShort(checkIn, lang)} – ${fmtShort(checkOut, lang)}`;
}
