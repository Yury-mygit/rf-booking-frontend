// Shared client state — последний открытый отель + pending subject для чата.
//
// `pendingSubject` сетится в момент тапа по иконке чата с контекстом
// (карточка комнаты / карточка брони) и автоматически прикрепляется к
// первому отправленному сообщению, после чего сбрасывается. На reload
// теряется — это намеренно: после релоада это уже не «о комнате», а
// просто переписка.
let _lastHotel = null;
let _pendingSubject = null;

export function setLastHotel(h) {
  _lastHotel = h;
}

export function getLastHotel() {
  return _lastHotel;
}

export function setPendingSubject(subj) {
  _pendingSubject = subj;
}

export function takePendingSubject() {
  const s = _pendingSubject;
  _pendingSubject = null;
  return s;
}
