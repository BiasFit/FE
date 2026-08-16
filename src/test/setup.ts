import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * 테스트는 오프라인으로 돈다.
 * `.env`에 VITE_SUPABASE_* 가 있으면 브라우저 클라이언트가 실제 Supabase로 나가서
 * 테스트가 네트워크에 매달린다. 인증 계층을 통째로 가짜로 바꾼다.
 *
 * `isAuthConfigured`를 false로 두면 라우트 가드가 통과되고,
 * `biasfitApi`의 postJson도 Authorization 헤더를 붙이지 않는다.
 * 즉 기존 화면 테스트는 인증이 없던 때와 똑같이 동작한다.
 */
vi.mock("../lib/supabaseClient", () => ({
  isAuthConfigured: false,
  TEST_EMAIL_DOMAIN: "biasfit.test",
  loginIdToEmail: (loginId: string) => `${loginId}@biasfit.test`,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  },
}));

// 파일을 병렬 실행하면 기본 1초 안에 렌더가 끝나지 않아 findBy*가 간헐적으로 실패한다.
configure({ asyncUtilTimeout: 5000 });

class ResizeObserverMock implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions) {}

  unobserve(_target: Element) {}

  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => {
  cleanup();
  // 진단 상태가 sessionStorage에 남는다. 안 지우면 다음 테스트가 앞 테스트의 진단을 이어받는다.
  sessionStorage.clear();
});
