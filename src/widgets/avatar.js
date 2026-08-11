// TBB-53: fallback avatar rendering — инициалы на цветном фоне когда
// у клиента ещё нет фото (либо приватность в TG скрыла photo_url).
//
// Возвращает inner-HTML для контейнера с уже заданными размерами
// (`.hotel-thumb` для листа, `.client-photo` для card view). Класс
// `.avatar-initials` центрирует текст; фон = детерминированный цвет
// из palette по хешу имени (одинаковый клиент → одинаковый цвет).

const PALETTE = [
  "#8ea9db", "#c98494", "#a5c294", "#e0b285",
  "#a09fc6", "#b8a58a", "#95bfd0", "#c9a5c7",
];

function _pickColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function _initials(firstName, lastName) {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "??";
}

// Возвращает атрибуты для контейнера: строку "class=... style=..." и
// готовый innerHTML (инициалы). Caller комбинирует с своим wrapper-классом
// (`hotel-thumb` / `client-photo` / etc).
export function initialsAvatarAttrs(firstName, lastName) {
  const bg = _pickColor(`${firstName || ""}|${lastName || ""}`);
  const initials = _initials(firstName, lastName);
  return { className: "avatar-initials", style: `background-color:${bg}`, initials };
}
