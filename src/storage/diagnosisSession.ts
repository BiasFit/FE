import { createInitialState, type AppState } from "../app/appState.js";

/**
 * 진행 중인 진단을 새로고침 뒤에도 이어갈 수 있게 보관한다.
 *
 * 이 상태가 메모리에만 있던 동안에는 새로고침 한 번에 입력·Style DNA·순위가 전부 사라져
 * 부탁해요 카드에서 "진단 결과가 없어요"로 막혔다 — `MEMO/진단결과_저장_실패_사건_스터디.md`.
 *
 * `sessionStorage`를 쓴다. 탭을 닫으면 사라지므로 브라우저에 오래 남지 않는다.
 * 비밀번호·토큰은 이 상태에 들어 있지 않다 (로그인 세션은 Supabase 클라이언트가 따로 관리한다).
 */
const APP_STATE_KEY = "biasfit:app-state:v1";

/**
 * 저장된 상태를 읽는다. 조금이라도 이상하면 **조용히 버리고 초기 상태**를 쓴다.
 * 배포로 상태 구조가 바뀌었을 때 옛 값이 복원되며 화면이 깨지는 것을 막는 안전장치다.
 */
export function loadAppState(): AppState {
  const initial = createInitialState();
  try {
    const stored = sessionStorage.getItem(APP_STATE_KEY);
    if (!stored) return initial;
    const parsed = JSON.parse(stored) as Partial<AppState> | null;
    if (!parsed || typeof parsed !== "object") return initial;
    // 초기 상태의 키를 모두 갖춘 값만 받아들인다. 하나라도 없으면 옛 구조로 본다.
    const missing = Object.keys(initial).some((key) => !(key in parsed));
    if (missing) return initial;
    return { ...initial, ...parsed };
  } catch {
    return initial;
  }
}

/** 상태가 바뀔 때마다 덮어쓴다. 저장 공간이 막힌 브라우저에서도 앱은 그대로 돌아야 한다. */
export function saveAppState(state: AppState) {
  try {
    sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  } catch {
    // 사파리 비공개 모드 등 저장이 막힌 환경. 유지가 안 될 뿐 흐름은 그대로 간다.
  }
}
