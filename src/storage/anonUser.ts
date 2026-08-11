// 계정 체계가 없는 MVP에서 같은 브라우저의 진단 회차를 하나로 묶는 익명 키다.
// 실제 개인정보가 아니며 (DB_SCHEMA.md 6장), 브라우저를 지우면 새 키가 생긴다.
const ANON_USER_KEY = "biasfit:anon-user-key:v1";

function createKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // randomUUID가 없는 환경(구형 브라우저·비보안 컨텍스트)을 위한 대체 경로.
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 저장된 익명 키를 돌려주고, 없으면 새로 만들어 보관한다. */
export function anonUserKey() {
  const stored = localStorage.getItem(ANON_USER_KEY);
  if (stored) return stored;
  const created = createKey();
  localStorage.setItem(ANON_USER_KEY, created);
  return created;
}
