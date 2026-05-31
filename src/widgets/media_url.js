// Хелпер для преобразования media-item в URL для тега <img>. Сейчас
// item — это просто URL-строка (текущее хранение в hotels.photos /
// rooms.photos). После media-миграции (#21) item станет объектом с
// uuid → переключится на `/api/v1/assets/<id>` без правок view.

export function mediaUrl(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (item.url) return item.url;
  if (item.id) return `/api/v1/assets/${item.id}`;
  return "";
}
