import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { isAuthConfigured } from "../lib/supabaseClient";

/**
 * 역할이 다른 화면에 들어가지 못하게 막는다.
 * `INFLUENCER_SCREEN_SPEC.md` 3.1 역할 판별 규칙: 사용자 계정으로 인플루언서 화면에
 * 접근하면 사용자 흐름으로 돌려보낸다.
 *
 * 역할은 `AuthProvider`가 서버에서 받아온 값만 쓴다. 브라우저가 기억한 값은 조작할 수 있다.
 */
export function RequireRole({
  role,
  children,
}: {
  role: "user" | "influencer";
  children: ReactNode;
}) {
  const { status, account } = useAuth();

  // 로그인 없이도 둘러볼 수 있게 두려면 환경변수가 없을 때는 통과시킨다.
  // (팀 데모나 인증 설정 전 상태)
  if (!isAuthConfigured) return <>{children}</>;

  if (status === "loading") {
    return (
      <section className="screen is-active">
        <div className="status-state" aria-live="polite">
          <div className="loading-ring" aria-label="계정 확인 중" />
          <p>계정을 확인하고 있어요.</p>
        </div>
      </section>
    );
  }

  if (status === "signedOut" || !account) {
    return <Navigate to={role === "influencer" ? "/influencer/login" : "/user/login"} replace />;
  }

  if (account.role !== role) {
    // 인플루언서 계정으로 사용자 흐름에 들어가는 것도 같은 이유로 막는다.
    return (
      <Navigate
        to={account.role === "influencer" ? "/influencer/requests" : "/user/coaching"}
        replace
      />
    );
  }

  return <>{children}</>;
}
