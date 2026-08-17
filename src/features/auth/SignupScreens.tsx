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
import { PrimaryCta, StepHeader, TopBar } from "../../shared/AppShell.js";
import iconCheck from "../../assets/mypage/icon-check.svg";
import iconCheckboxUnchecked from "../../assets/mypage/icon-checkbox-unchecked.svg";

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
  snsAccount: "",
};

/** 동의 항목 한 줄. 서비스 이용약관·개인정보 처리방침·(역할별) 세 번째 항목이 함께 쓴다. */
function ConsentRow({
  label,
  required,
  checked,
  onToggle,
  last,
}: {
  label: string;
  required: boolean;
  checked: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex w-full items-center gap-3 py-3 ${last ? "" : "border-b border-[#e0e0e4]"}`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <img
        src={checked ? iconCheck : iconCheckboxUnchecked}
        alt=""
        aria-hidden="true"
        className="size-[22px] shrink-0"
      />
      <span className="text-[12px] text-[#0a0a0a]">{label}</span>
      <span className="flex-1" />
      <span className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
        {required ? "필수" : "선택"}
      </span>
    </label>
  );
}

/** A2 · 회원가입 유형 선택 (피그마 `12 · v3 · 추가 화면`). */
export function SignupRoleScreen() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AccountRole | null>(null);

  const next = () => {
    if (role) {
      navigate(role === "user" ? "/user/signup" : "/influencer/signup");
    }
  };

  const cards: Array<{
    role: AccountRole;
    title: string;
    description: string;
    caption: string;
  }> = [
    {
      role: "user",
      title: "사용자로 시작하기",
      description: "내 체형·취향·예산에 맞는\n코디 카드를 받고 싶어요.",
      caption: "스타일 진단 · 인플루언서 추천 · 코디 카드 받기",
    },
    {
      role: "influencer",
      title: "인플루언서로 시작하기",
      description: "다른 사람에게 코디를\n제안해 주고 싶어요.",
      caption: "프로필 등록 · 요청 확인 · 코디 카드 작성",
    },
  ];

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate(-1)} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[14px]">
        <h1 className="m-0 text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
          어떤 역할로
          <br />
          시작할까요?
        </h1>
        <div className="h-[10px]" />
        <p className="text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#8e8e93]">
          가입 후에는 역할을 바꿀 수 없어요.
        </p>
        <div className="h-[34px]" />
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="가입 유형">
          {cards.map((card) => {
            const selected = role === card.role;
            return (
              <button
                key={card.role}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRole(card.role)}
                className={
                  selected
                    ? "flex w-full flex-col rounded-[18px] border-[1.6px] border-[#0a0a0a] bg-white px-5 py-[22px] text-left shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                    : "flex w-full flex-col rounded-[18px] bg-[#f5f5f7] px-5 py-[22px] text-left"
                }
              >
                <div className="flex w-full items-center gap-[10px]">
                  <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">{card.title}</p>
                  <div className="flex-1" />
                  {selected ? <img src={iconCheck} alt="" className="size-[22px]" /> : null}
                </div>
                <div className="h-2" />
                <p className="whitespace-pre-line text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#3c3c43]">
                  {card.description}
                </p>
                <div className="h-[14px]" />
                <p className="text-[12px] text-[#8e8e93]">{card.caption}</p>
              </button>
            );
          })}
        </div>
      </div>
      <PrimaryCta onClick={next} disabled={!role}>
        다음
      </PrimaryCta>
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
  // 피그마 A3/A4 라벨: 사용자는 "닉네임", 인플루언서는 기존과 같이 "활동명".
  const displayNameLabel = isInfluencer ? "활동명" : "닉네임";
  const submitLabel = isInfluencer ? "가입하고 프로필 만들기" : "가입하고 시작하기";

  // 동의 항목은 화면에만 있는 값이라 signUp() 페이로드에 넣지 않는다 — 서버 가입 API가
  // 아직 동의 여부를 받지 않기 때문. 필수 항목을 안 채우면 제출 버튼만 막는다.
  const [consentTerms, setConsentTerms] = useState(true);
  const [consentPrivacy, setConsentPrivacy] = useState(true);
  const [consentThird, setConsentThird] = useState(isInfluencer);
  const consentReady = consentTerms && consentPrivacy && (!isInfluencer || consentThird);

  const refs: Record<RequiredField, RefObject<HTMLInputElement | null>> = {
    loginId: loginIdRef,
    displayName: displayNameRef,
    password: passwordRef,
    passwordConfirm: passwordConfirmRef,
  };

  const update =
    (field: keyof SignupForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      if (field in errors) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
    };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: SignupErrors = {};

    if (!form.loginId.trim()) {
      nextErrors.loginId = "아이디를 입력해 주세요.";
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

  // 생년월일은 화면에서 뺐다 (피그마 A3/A4에 없는 필드) — 값 자체는 폼 상태에 남겨
  // 두는데, signUp() 호출도 원래부터 이 값을 안 보냈어서 화면만 빼면 그만이다.
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="1 / 2"
        progress={0.5}
        onBack={() => navigate(-1)}
        title={
          <>
            {isInfluencer ? "인플루언서 계정을" : "사용자 계정을"}
            <br />
            만들어 주세요.
          </>
        }
        description={
          isInfluencer
            ? "가입 후 첫 로그인에서 스타일링 프로필을 작성해요."
            : "실제 개인정보는 입력하지 않아요."
        }
      />
      <form
        className="flex flex-1 flex-col px-5 pb-6 pt-[22px]"
        onSubmit={submit}
        noValidate
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-[5px] text-[12px] text-[#8e8e93]">
              {displayNameLabel} <span className="text-[11px] font-semibold text-[#0a0a0a]">필수</span>
            </span>
            <input
              ref={displayNameRef}
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="text"
              placeholder={isInfluencer ? "활동명을 입력해 주세요" : "닉네임을 입력해 주세요"}
              value={form.displayName}
              onChange={update("displayName")}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName ? (
              <span className="text-[13px] font-semibold text-[#0a0a0a]">{errors.displayName}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-[5px] text-[12px] text-[#8e8e93]">
              아이디 <span className="text-[11px] font-semibold text-[#0a0a0a]">필수</span>
            </span>
            <input
              ref={loginIdRef}
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="text"
              autoComplete="username"
              placeholder="예) minji01"
              value={form.loginId}
              onChange={update("loginId")}
              aria-invalid={Boolean(errors.loginId)}
            />
            {errors.loginId ? (
              <span className="text-[13px] font-semibold text-[#0a0a0a]">{errors.loginId}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-[5px] text-[12px] text-[#8e8e93]">
              비밀번호 <span className="text-[11px] font-semibold text-[#0a0a0a]">필수</span>
            </span>
            <input
              ref={passwordRef}
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상 입력해 주세요"
              value={form.password}
              onChange={update("password")}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password ? (
              <span className="text-[13px] font-semibold text-[#0a0a0a]">{errors.password}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-[5px] text-[12px] text-[#8e8e93]">
              비밀번호 확인 <span className="text-[11px] font-semibold text-[#0a0a0a]">필수</span>
            </span>
            <input
              ref={passwordConfirmRef}
              className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
              type="password"
              autoComplete="new-password"
              placeholder="다시 한 번 입력해 주세요"
              value={form.passwordConfirm}
              onChange={update("passwordConfirm")}
              aria-invalid={Boolean(errors.passwordConfirm)}
            />
            {errors.passwordConfirm ? (
              <span className="text-[13px] font-semibold text-[#0a0a0a]">{errors.passwordConfirm}</span>
            ) : null}
          </label>

          {isInfluencer ? (
            <label className="flex flex-col gap-2">
              <span className="text-[12px] text-[#8e8e93]">SNS 계정 (선택)</span>
              <input
                className="min-h-[56px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
                type="text"
                placeholder="instagram.com/아이디"
                value={form.snsAccount}
                onChange={update("snsAccount")}
              />
            </label>
          ) : null}
        </div>

        {isInfluencer ? (
          <>
            <div className="h-[26px]" />
            <div className="w-full rounded-[18px] bg-[#f5f5f7] p-5">
              <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">가입 후 바로 할 일</p>
              <div className="h-[10px]" />
              <div className="flex flex-col gap-1 text-[12px] text-[#3c3c43]">
                <p>· 대표 스타일 1·2순위 선택</p>
                <p>· 담당 가능한 체형과 핏 고민 선택</p>
                <p>· 가격대와 강점 상황(TPO) 3개 선택</p>
              </div>
              <div className="h-3" />
              <p className="text-[11px] font-semibold text-[#8e8e93]">프로필은 1회만 작성하고 이후 수정할 수 없어요.</p>
            </div>
          </>
        ) : null}

        <div className="h-[26px]" />
        <div className="w-full rounded-[18px] bg-[#f5f5f7] px-5 py-[6px]">
          <ConsentRow
            label="서비스 이용약관 동의"
            required
            checked={consentTerms}
            onToggle={() => setConsentTerms((v) => !v)}
          />
          <ConsentRow
            label="개인정보 처리방침 동의"
            required
            checked={consentPrivacy}
            onToggle={() => setConsentPrivacy((v) => !v)}
          />
          <ConsentRow
            label={isInfluencer ? "코디 카드 작성 가이드 확인" : "마케팅 정보 수신 동의"}
            required={isInfluencer}
            checked={consentThird}
            onToggle={() => setConsentThird((v) => !v)}
            last
          />
        </div>
        <div className="h-[18px]" />
        <p className="text-[12px] text-[#8e8e93]">
          {isInfluencer ? "실제 개인정보와 신체 사진은 입력하지 않아요." : "가입 후에는 역할을 바꿀 수 없어요."}
        </p>

        {submitError ? (
          <p className="mt-3 text-[13px] font-semibold text-[#0a0a0a]" aria-live="polite">
            {submitError}
          </p>
        ) : null}

        <div className="flex-1" />
        <div className="h-6" />
        <button
          type="submit"
          disabled={submitting || !consentReady}
          className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-40"
        >
          {submitting ? "가입하는 중…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => navigate(isInfluencer ? "/influencer/login" : "/user/login")}
          className="mt-3 text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          이미 계정이 있어요 · 로그인
        </button>
      </form>
    </section>
  );
}

export function UserSignupScreen() {
  return <SignupFormScreen role="user" />;
}

export function InfluencerSignupScreen() {
  return <SignupFormScreen role="influencer" />;
}
