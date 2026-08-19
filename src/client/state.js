// Shared client state — pending subject для чата и hash-возврата.
//
// `pendingSubject` сетится в момент тапа по иконке чата с контекстом
// (карточка комнаты / карточка брони) и автоматически прикрепляется к
// первому отправленному сообщению, после чего сбрасывается. На reload
// теряется — это намеренно: после релоада это уже не «о комнате», а
// просто переписка.

let _pendingSubject = null;
let _chatReturnHash = null;

export function setPendingSubject(subj) {
  _pendingSubject = subj;
}

export function takePendingSubject() {
  const s = _pendingSubject;
  _pendingSubject = null;
  return s;
}

export function setChatReturnHash(h) {
  _chatReturnHash = h;
}

export function getChatReturnHash() {
  return _chatReturnHash;
}
