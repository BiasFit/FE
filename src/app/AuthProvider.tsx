import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createAccount,
  getMyAccount,
  type AccountView,
} from "../lib/biasfitApi";
import { isAuthConfigured, loginIdToEmail, supabase } from "../lib/supabaseClient";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  /** 서버가 확인해 준 계정. 역할 판별은 반드시 이 값으로 한다. */
  account: AccountView | null;
  signUp(input: {
    role: AccountView["role"];
    loginId: string;
    displayName: string;
    password: string;
  }): Promise<AccountView>;
  signIn(input: { loginId: string; password: string }): Promise<AccountView>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Supabase 오류 원문에는 내부 정보가 섞인다. 사용자에게는 짧은 한국어만 보여준다. */
function toUserMessage(error: { message?: string } | null, fallback: string) {
  const raw = error?.message ?? "";
  if (/invalid login credentials/i.test(raw)) {
    return "아이디 또는 비밀번호가 맞지 않아요.";
  }
  if (/already registered|already been registered/i.test(raw)) {
    return "이미 가입된 아이디예요.";
  }
  if (/password/i.test(raw) && /least|short/i.test(raw)) {
    return "비밀번호는 6자 이상이어야 해요.";
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isAuthConfigured ? "loading" : "signedOut",
  );
  const [account, setAccount] = useState<AccountView | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const me = await getMyAccount();
      setAccount(me);
      setStatus("signedIn");
      return me;
    } catch {
      // 토큰은 있는데 accounts 행이 없는 경우다. 로그아웃 상태로 둔다.
      setAccount(null);
      setStatus("signedOut");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthConfigured) return;
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) {
        setStatus("signedOut");
        return;
      }
      void loadAccount();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session) {
        setAccount(null);
        setStatus("signedOut");
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAccount]);

  /**
   * 인증 환경변수가 없으면 네트워크를 타지 않고 그 자리에서 계정을 만든 것처럼 둔다.
   * 팀 데모와 자동 테스트가 Supabase 없이도 화면 흐름을 그대로 확인할 수 있어야 한다.
   * 실제 배포에서는 항상 환경변수가 있으므로 이 경로를 타지 않는다.
   */
  const localAccount = useCallback(
    (role: AccountView["role"], loginId: string, displayName?: string) => {
      const next: AccountView = {
        accountId: `local-${role}-${loginId}`,
        role,
        loginId,
        displayName: displayName ?? loginId,
      };
      setAccount(next);
      setStatus("signedIn");
      return next;
    },
    [],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(async (input) => {
    if (!isAuthConfigured) {
      return localAccount(input.role, input.loginId.trim(), input.displayName.trim());
    }
    const email = loginIdToEmail(input.loginId);
    const { error } = await supabase.auth.signUp({ email, password: input.password });

    // Auth 사용자만 만들어지고 accounts 행 생성이 실패하면 반쪽 상태가 남는다.
    // 그 상태에서 다시 가입하면 "이미 가입됨"이 나므로, 로그인으로 이어받아 마저 만든다.
    const alreadyRegistered =
      error && /already registered|already been registered|User already/i.test(error.message ?? "");
    if (error && !alreadyRegistered) {
      throw new Error(toUserMessage(error, "가입하지 못했어요."));
    }

    const signedIn = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (signedIn.error) {
      throw new Error(
        alreadyRegistered
          ? "이미 가입된 아이디예요. 비밀번호가 맞는지 확인해 주세요."
          : toUserMessage(signedIn.error, "가입하지 못했어요."),
      );
    }

    // accounts 행을 만든다. 이미 있으면 그대로 돌려받는다.
    // authUserId는 프런트가 보내지 않는다. 서버가 토큰에서 꺼낸다.
    const created = await createAccount({
      role: input.role,
      loginId: input.loginId.trim(),
      displayName: input.displayName.trim(),
    });
    setAccount(created);
    setStatus("signedIn");
    return created;
  }, [localAccount]);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (input) => {
    if (!isAuthConfigured) {
      // 인플루언서 테스트 아이디는 stylemate로 시작한다.
      const role = input.loginId.trim().toLowerCase().startsWith("stylemate")
        ? "influencer"
        : "user";
      return localAccount(role, input.loginId.trim());
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdToEmail(input.loginId),
      password: input.password,
    });
    if (error) throw new Error(toUserMessage(error, "로그인하지 못했어요."));

    const me = await loadAccount();
    if (!me) throw new Error("계정 설정이 끝나지 않았어요. 회원가입을 다시 진행해 주세요.");
    return me;
  }, [loadAccount, localAccount]);

  const signOut = useCallback(async () => {
    if (isAuthConfigured) await supabase.auth.signOut();
    setAccount(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(
    () => ({ status, account, signUp, signIn, signOut }),
    [status, account, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
