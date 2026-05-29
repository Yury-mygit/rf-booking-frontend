// Общий helper для всех клиентских точек входа в чат (view отеля,
// карточка комнаты, карточка брони). Делает get-or-create thread,
// сохраняет subject в локальном state, переходит на /chat/thread/<id>.
//
// Формат `subject` (используется SubjectCard в thread view):
//   { type: "booking"|"room"|"hotel", id,
//     name?: string,        // отображаемое название
//     photo?: string,       // URL миниатюры (опционально)
//     extra?: string,       // вторая строка (даты брони, цена комнаты, …)
//     hotel_slug?: string } // для тапа SubjectCard → entity view
// На backend (api.chatOpenThread / send_message) уходят только `type`+`id`;
// display-поля остаются на фронте.

import { api } from "../../../api.js";
import { t } from "../../../i18n.js";
import { navigate } from "../../../router.js";
import { setPendingSubject } from "../../state.js";

export const CHAT_ICON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export async function openChatWithHotel(hotelId, subject) {
  if (!api.hasToken()) {
    navigate("#/client/login");
    return;
  }
  if (subject) setPendingSubject(subject);
  try {
    const thread = await api.chatOpenThread(hotelId, subject);
    navigate(`#/client/chat/thread/${thread.id}`);
  } catch (e) {
    alert(t("common.error", { msg: e.message }));
  }
}
