import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AccountRole, SignupForm } from "../../app/types.js";
import { useAuth } from "../../app/AuthProvider.js";

type RequiredField =
  | "loginId"
  | "displayName"
  | "password"
  | "passwordConfirm";

type SignupErrors = Partial<Record<RequiredField, string>>;

const emptyForm: SignupForm = {
  loginId: "",
  displayName: "",
  password: "",
  passwordConfirm: "",
  birthDate: "",
  profileImageName: "",
};

function SignupContext({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <aside className="context-panel">
      <p className="context-brand">BiasFit</p>
      <p className="context-step">SIGN UP · {step}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="signup-context-steps" aria-label="회원가입 진행 단계">
        <span className={step === "01 / 02" ? "active" : "done"}>
          1. 가입 유형
        </span>
        <span className={step === "02 / 02" ? "active" : ""}>
          2. 계정 정보
        </span>
      </div>
      <p className="safety-note">
        테스트 단계에서는 실제 개인정보나 실제 얼굴 사진을 입력하지 않아요.
      </p>
    </aside>
  );
}

export function SignupRoleScreen() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AccountRole | null>(null);

  const next = () => {
    if (role) {
      navigate(role === "user" ? "/user/signup" : "/influencer/signup");
    }
  };

  return (
    <section className="screen is-active">
      <div className="service-layout">
        <SignupContext
          step="01 / 02"
          title="내 역할에 맞는 시작점을 골라요."
          description="가입 유형에 따라 필요한 다음 화면만 이어서 보여드려요."
        />
        <div className="work-panel">
          <div className="work-head">
            <p className="eyebrow">CHOOSE ACCOUNT</p>
            <h1 className="page-title">어떤 계정으로 시작할까요?</h1>
            <p className="page-desc">
              가입 후 이용할 역할을 선택해 주세요. 가입 유형은 완료 후 변경할
              수 없어요.
            </p>
          </div>
          <div className="work-body">
            <div
              className="card-grid signup-role-grid"
              role="radiogroup"
              aria-label="가입 유형"
            >
              <button
                className={`option-card ${role === "user" ? "selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={role === "user"}
                onClick={() => setRole("user")}
              >
                <span className="signup-role-icon" aria-hidden="true">
                  U
                </span>
                <strong>일반 사용자</strong>
                <p>Style DNA를 만들고 나와 맞는 스타일메이트를 찾아요.</p>
                <span className="check" aria-hidden="true">
                  ✓
                </span>
              </button>
              <button
                className={`option-card ${role === "influencer" ? "selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={role === "influencer"}
                onClick={() => setRole("influencer")}
              >
                <span className="signup-role-icon" aria-hidden="true">
                  I
                </span>
                <strong>인플루언서</strong>
                <p>코칭 프로필을 만들고 배정된 코디 요청을 확인해요.</p>
                <span className="check" aria-hidden="true">
                  ✓
                </span>
              </button>
            </div>
            <button
              className="btn-ghost signup-login-link"
              type="button"
              onClick={() => navigate("/user/login")}
            >
              이미 계정이 있어요 · 로그인
            </button>
          </div>
          <div className="work-actions">
            <button
              className="btn-ghost"
              type="button"
              onClick={() => navigate(-1)}
            >
              이전
            </button>
            <button
              className="btn-primary"
              type="button"
              disabled={!role}
              onClick={next}
            >
              다음 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignupFormScreen({ role }: { role: AccountRole }) {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState<SignupForm>(emptyForm);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const loginIdRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const isInfluencer = role === "influencer";
  const displayNameLabel = isInfluencer ? "활동명" : "표시 이름";
  const submitLabel = isInfluencer
    ? "인플루언서로 가입하기"
    : "사용자로 가입하기";

  const refs: Record<RequiredField, RefObject<HTMLInputElement | null>> = {
    loginId: loginIdRef,
    displayName: displayNameRef,
    password: passwordRef,
    passwordConfirm: passwordConfirmRef,
  };

  const update =
    (field: keyof SignupForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]:
          field === "profileImageName"
            ? event.target.files?.[0]?.name ?? ""
            : event.target.value,
      }));
      if (field in errors) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
    };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: SignupErrors = {};

    if (!form.loginId.trim()) {
      nextErrors.loginId = "로그인 아이디를 입력해 주세요.";
    }
    if (!form.displayName.trim()) {
      nextErrors.displayName = `${displayNameLabel}을 입력해 주세요.`;
    }
    if (!form.password) {
      nextErrors.password = "비밀번호를 입력해 주세요.";
    }
    if (!form.passwordConfirm) {
      nextErrors.passwordConfirm = "비밀번호 확인을 입력해 주세요.";
    } else if (form.password !== form.passwordConfirm) {
      nextErrors.passwordConfirm = "비밀번호가 일치하지 않아요.";
    }

    setErrors(nextErrors);
    const firstInvalid = (
      [
        "loginId",
        "displayName",
        "password",
        "passwordConfirm",
      ] as RequiredField[]
    ).find((field) => nextErrors[field]);

    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    void signUp({
      role,
      loginId: form.loginId,
      displayName: form.displayName,
      password: form.password,
    })
      .then(() => navigate(isInfluencer ? "/influencer/profile" : "/user/coaching"))
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "가입하지 못했어요.");
        setSubmitting(false);
      });
  };

  return (
    <section className="screen is-active">
      <div className="service-layout">
        <SignupContext
          step="02 / 02"
          title={
            isInfluencer
              ? "스타일메이트 활동을 시작해요."
              : "나의 스타일 기준을 시작해요."
          }
          description="필수 계정 정보만 입력하고, 선택 정보는 비워 두어도 괜찮아요."
        />
        <div className="work-panel">
          <div className="work-head">
            <p className="eyebrow">
              {isInfluencer ? "INFLUENCER SIGN UP" : "USER SIGN UP"}
            </p>
            <h1 className="page-title">
              {isInfluencer
                ? "인플루언서 계정을 만들어요."
                : "사용자 계정을 만들어요."}
            </h1>
            <p className="page-desc">
              실제 이메일 대신 테스트용 아이디와 이름을 사용해 주세요.
            </p>
          </div>
          <div className="work-body">
            <form className="login-card signup-form" onSubmit={submit} noValidate>
              <div className="signup-section-head">
                <div>
                  <p className="eyebrow">필수 정보</p>
                  <h2 className="sub-title">로그인에 필요한 정보</h2>
                </div>
                <span className="badge">필수</span>
              </div>

              <label
                className={`field ${errors.loginId ? "is-error" : ""}`}
              >
                <span className="field-label">
                  로그인 아이디 <span className="required">필수</span>
                </span>
                <input
                  ref={loginIdRef}
                  className="text-input"
                  type="text"
                  autoComplete="username"
                  value={form.loginId}
                  onChange={update("loginId")}
                  aria-invalid={Boolean(errors.loginId)}
                />
                {errors.loginId ? (
                  <span className="signup-error">{errors.loginId}</span>
                ) : null}
              </label>

              <label
                className={`field ${errors.displayName ? "is-error" : ""}`}
              >
                <span className="field-label">
                  {displayNameLabel} <span className="required">필수</span>
                </span>
                <input
                  ref={displayNameRef}
                  className="text-input"
                  type="text"
                  value={form.displayName}
                  onChange={update("displayName")}
                  aria-invalid={Boolean(errors.displayName)}
                />
                {errors.displayName ? (
                  <span className="signup-error">{errors.displayName}</span>
                ) : null}
              </label>

              <label
                className={`field ${errors.password ? "is-error" : ""}`}
              >
                <span className="field-label">
                  비밀번호 <span className="required">필수</span>
                </span>
                <input
                  ref={passwordRef}
                  className="text-input"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update("password")}
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password ? (
                  <span className="signup-error">{errors.password}</span>
                ) : null}
              </label>

              <label
                className={`field ${errors.passwordConfirm ? "is-error" : ""}`}
              >
                <span className="field-label">
                  비밀번호 확인 <span className="required">필수</span>
                </span>
                <input
                  ref={passwordConfirmRef}
                  className="text-input"
                  type="password"
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={update("passwordConfirm")}
                  aria-invalid={Boolean(errors.passwordConfirm)}
                />
                {errors.passwordConfirm ? (
                  <span className="signup-error">
                    {errors.passwordConfirm}
                  </span>
                ) : null}
              </label>

              <div className="signup-optional">
                <div className="signup-section-head">
                  <div>
                    <p className="eyebrow">선택 정보</p>
                    <h2 className="sub-title">나중에 입력해도 괜찮아요</h2>
                  </div>
                  <span className="badge blue">선택</span>
                </div>

                <label className="field">
                  <span className="field-label">생년월일</span>
                  <input
                    className="text-input"
                    type="date"
                    value={form.birthDate}
                    onChange={update("birthDate")}
                  />
                </label>

                <label className="field">
                  <span className="field-label">프로필 사진</span>
                  <input
                    className="signup-file-input"
                    type="file"
                    accept="image/*"
                    onChange={update("profileImageName")}
                  />
                  <span className="helper">
                    테스트용 샘플 이미지만 선택해 주세요. 사진 내용은 저장하지
                    않아요.
                  </span>
                  {form.profileImageName ? (
                    <span className="signup-file-name">
                      선택됨 · {form.profileImageName}
                    </span>
                  ) : null}
                </label>
              </div>

              {submitError ? (
                <p className="error-copy" style={{ display: "block" }} aria-live="polite">
                  {submitError}
                </p>
              ) : null}
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "가입하는 중…" : submitLabel}
              </button>
              <button
                className="btn-ghost signup-login-link"
                type="button"
                onClick={() =>
                  navigate(
                    isInfluencer ? "/influencer/login" : "/user/login",
                  )
                }
              >
                이미 계정이 있어요 · 로그인
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export function UserSignupScreen() {
  return <SignupFormScreen role="user" />;
}

export function InfluencerSignupScreen() {
  return <SignupFormScreen role="influencer" />;
}
