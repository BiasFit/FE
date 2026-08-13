import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupOutfitDraft, OutfitFields as OutfitFieldValues, PersonalOutfitDraft } from "../../app/types";
import type { OutfitReviewResponse } from "../../domain/aiContracts";
import { useAppState } from "../../app/AppStateProvider";
import { useAuth } from "../../app/AuthProvider";
import {
  TPO_CODES,
  budgetApproaches,
  budgetRangeLabel,
  fitConcerns,
  styleOptions,
  tpoLabel,
} from "../../data/options";
import type { CoachingSupport } from "../../domain/scoring";
import { personaForms } from "../../data/personas";
import { isValidOutfitDraft, isValidProductUrl, toOutfitReviewRequest } from "../../domain/outfit";
import {
  getAssignedRequests,
  getDiagnosisResult,
  reviewOutfit,
  type AssignedRequestView,
  type DiagnosisResultView,
} from "../../lib/biasfitApi";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type OutfitDraft,
} from "../../storage/drafts";
import { ChipChoices, FlowShell } from "../../shared/FlowShell";
import { BudgetRangeSlider } from "../../shared/BudgetRangeSlider";
import { OutfitReviewPanel } from "./OutfitReviewPanel";

const personalDefault: PersonalOutfitDraft = {
  top: { name: "아이보리 셔링 블라우스", url: "https://example.com/products/ivory-blouse" },
  bottom: { name: "세미 A라인 데님 스커트", url: "https://example.com/products/denim-skirt" },
  message:
    "상의 디테일은 부드럽게 살리고, 하의는 허리선이 잘 보이는 길이로 골라 전체 비율이 답답하지 않도록 했어요.",
};

const groupDefault: GroupOutfitDraft = {
  memberA: {
    top: { name: "오프화이트 반팔 티셔츠", url: "https://example.com/products/off-white-tshirt" },
    bottom: { name: "연청 A라인 스커트", url: "https://example.com/products/light-denim-skirt" },
  },
  memberB: {
    top: { name: "오프화이트 린넨 셔츠", url: "https://example.com/products/linen-shirt" },
    bottom: { name: "네이비 와이드 슬랙스", url: "https://example.com/products/navy-slacks" },
  },
  message:
    "각자의 취향은 유지하고 오프화이트 상의와 소프트 블루 포인트로 연결감을 만들었어요.",
};

export function InfluencerLoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loginId, setLoginId] = useState("stylemate01");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const login = () => {
    setLoggingIn(true);
    setLoginError("");
    void signIn({ loginId, password })
      .then((account) => {
        // 사용자 계정으로 인플루언서 워크스페이스에 들어오는 것을 막는다
        // (INFLUENCER_SCREEN_SPEC.md 3.1 역할 판별 규칙).
        navigate(account.role === "influencer" ? "/influencer/requests" : "/user/coaching");
      })
      .catch((error: unknown) => {
        setLoginError(error instanceof Error ? error.message : "로그인하지 못했어요.");
        setLoggingIn(false);
      });
  };

  return (
    <FlowShell
      flow="influencer"
      step={1}
      eyebrow="INFLUENCER WORKSPACE"
      title={
        <>
          배정된 요청을 확인하고
          <br />
          코디 카드를 전달하세요.
        </>
      }
      description="팀이 만든 인플루언서 테스트 계정으로만 이용합니다."
    >
      <div className="login-card">
        <label className="field">
          <span className="field-label">테스트 아이디</span>
          <input
            className="text-input"
            type="text"
            autoComplete="username"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">테스트 코드</span>
          <input
            className="text-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {loginError ? (
          <p className="error-copy" style={{ display: "block" }} aria-live="polite">
            {loginError}
          </p>
        ) : null}
        <button
          className="btn-primary"
          type="button"
          disabled={loggingIn || !loginId.trim() || !password}
          onClick={login}
        >
          {loggingIn ? "로그인하는 중이에요." : "로그인"}
        </button>
        <button
          className="btn-ghost signup-login-link"
          type="button"
          onClick={() => navigate("/signup")}
        >
          처음이신가요? 회원가입
        </button>
      </div>
    </FlowShell>
  );
}

/** 인플루언서 강점 TPO는 정확히 3개다 (STYLE_SCORING_DRAFT.md 2.4, README 제품 규칙). */
const REQUIRED_PROFILE_TPO_COUNT = 3;

const COACHING_TYPE_LABEL: Record<CoachingSupport, string> = {
  personal_only: "개인 코칭만",
  group_only: "2인 그룹 코칭만",
  both: "개인·2인 그룹 모두",
};

export function InfluencerProfileScreen() {
  const navigate = useNavigate();
  const [primaryStyle, setPrimaryStyle] = useState("로맨틱");
  const [secondaryStyle, setSecondaryStyle] = useState("캐주얼");
  const [bodyType, setBodyType] = useState("웨이브");
  const [concerns, setConcerns] = useState([
    "밑위·하의 길이",
    "전체 기장·비율",
  ]);
  const [budgetMinCode, setBudgetMinCode] = useState(2);
  const [budgetMaxCode, setBudgetMaxCode] = useState(3);
  // 어휘는 반드시 사용자 쪽과 같은 목록에서 가져온다. 직접 문자열을 쓰면 매칭이 조용히 0점이 된다.
  const [budgetApproach, setBudgetApproach] = useState<string>(budgetApproaches[0]);
  // TPO는 내부 코드로 들고 화면에만 tpoLabel()로 바꿔 보여준다.
  const [occasions, setOccasions] = useState<string[]>([
    "new_semester",
    "daily",
    "travel",
  ]);
  const [coachingType, setCoachingType] = useState<CoachingSupport>("both");
  const [showError, setShowError] = useState(false);
  // 강점 TPO는 사용자 TPO 후보와 같은 8개에서 고른다 (STYLE_SCORING_DRAFT.md 2.4).
  const valid =
    primaryStyle !== secondaryStyle &&
    concerns.length > 0 &&
    occasions.length === REQUIRED_PROFILE_TPO_COUNT;
  return (
    <FlowShell
      flow="influencer"
      step={1}
      eyebrow="FIRST PROFILE"
      title={
        <>
          매칭에 사용할
          <br />
          코칭 정보를 선택해 주세요.
        </>
      }
      description="프로필은 테스트 계정별 첫 로그인 시 한 번만 생성합니다."
      actions={
        <>
          <button className="btn-ghost" type="button" onClick={() => navigate("/influencer/login")}>
            이전
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              if (!valid) {
                setShowError(true);
                return;
              }
              localStorage.setItem(
                "biasfit:influencer-profile:v1:stylemate-01",
                JSON.stringify({
                  primaryStyle,
                  secondaryStyle,
                  bodyType,
                  concerns,
                  budgetMinCode,
                  budgetMaxCode,
                  budgetApproach,
                  occasions,
                  coachingType,
                }),
              );
              navigate("/influencer/requests");
            }}
          >
            프로필 완성하기 <span aria-hidden="true">✓</span>
          </button>
        </>
      }
    >
      <div className="field">
        <div className="field-label">대표 스타일 1순위 <span className="required">1개</span></div>
        <SingleChoice values={styleOptions.map((option) => option.name)} selected={primaryStyle} onChange={setPrimaryStyle} disabled={secondaryStyle} />
      </div>
      <div className="field">
        <div className="field-label">대표 스타일 2순위 <span className="required">1순위와 다르게</span></div>
        <SingleChoice values={styleOptions.map((option) => option.name)} selected={secondaryStyle} onChange={setSecondaryStyle} disabled={primaryStyle} />
      </div>
      <div className="field">
        <div className="field-label">본인의 체형 유형 <span className="required">1개</span></div>
        <SingleChoice values={["스트레이트", "웨이브", "내추럴"]} selected={bodyType} onChange={setBodyType} />
      </div>
      <div className="field">
        <div className="field-label choice-title">자주 다루는 핏 고민 <span className="choice-count">최대 2개</span></div>
        <ChipChoices values={fitConcerns} selected={concerns} max={2} onChange={setConcerns} />
      </div>
      <div className="field">
        <div className="field-label choice-title">제안 가능한 가격대</div>
        <BudgetRangeSlider
          minCode={budgetMinCode}
          maxCode={budgetMaxCode}
          onChange={({ minCode, maxCode }) => {
            setBudgetMinCode(minCode);
            setBudgetMaxCode(maxCode);
          }}
        />
      </div>
      <div className="field">
        <div className="field-label">예산 접근 방식 <span className="required">1개</span></div>
        <SingleChoice values={budgetApproaches} selected={budgetApproach} onChange={setBudgetApproach} />
      </div>
      <div className="field">
        <div className="field-label">코칭 강점 TPO <span className="required">정확히 {REQUIRED_PROFILE_TPO_COUNT}개</span></div>
        <ChipChoices
          values={TPO_CODES}
          selected={occasions}
          max={REQUIRED_PROFILE_TPO_COUNT}
          onChange={setOccasions}
          labelFor={tpoLabel}
        />
      </div>
      <div className="field">
        <div className="field-label">지원 코칭 유형 <span className="required">1개</span></div>
        <SingleChoice
          values={Object.keys(COACHING_TYPE_LABEL)}
          selected={coachingType}
          onChange={(value) => setCoachingType(value as CoachingSupport)}
          labelFor={(value) => COACHING_TYPE_LABEL[value as CoachingSupport]}
        />
      </div>
      {showError && !valid ? <p className="error-copy" style={{ display: "block" }}>필수 항목을 모두 선택해 주세요.</p> : null}
    </FlowShell>
  );
}

function SingleChoice({
  values,
  selected,
  onChange,
  disabled,
  labelFor,
}: {
  values: readonly string[];
  selected: string;
  onChange: (value: string) => void;
  disabled?: string;
  /** 내부 코드를 값으로 쓰면서 화면에는 한글 라벨을 보여줄 때 넘긴다. */
  labelFor?: (value: string) => string;
}) {
  return (
    <div className="chip-wrap" role="radiogroup">
      {values.map((value) => (
        <button
          className={`chip ${selected === value ? "selected" : ""}`}
          type="button"
          role="radio"
          aria-checked={selected === value}
          disabled={disabled === value}
          key={value}
          onClick={() => onChange(value)}
        >
          {labelFor ? labelFor(value) : value}
        </button>
      ))}
    </div>
  );
}

const assignedRequests = [
  {
    id: "P1-2026-001",
    mode: "개인",
    tpo: "new_semester",
    detail: "부탁해요 카드 · 오늘 오후 10:37",
    done: false,
  },
  {
    id: "G1-2026-004",
    mode: "2인 그룹",
    tpo: "travel",
    detail: "P4·P5 부탁해요 카드 · 어제 오후 8:12",
    done: false,
  },
  {
    id: "P2-2026-002",
    mode: "개인",
    tpo: "daily",
    detail: "코디 카드 전달 · 7월 19일",
    done: true,
  },
];

function sentAtLabel(sentAt: string | null) {
  if (!sentAt) return "전송 시각 없음";
  const date = new Date(sentAt);
  return `부탁해요 카드 · ${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

export function InfluencerRequestsScreen() {
  const navigate = useNavigate();
  const { dispatch } = useAppState();
  const { account } = useAuth();
  const [requests, setRequests] = useState<AssignedRequestView[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // 내게 배정된 요청만 받는다. 수신자 판별은 서버가 토큰으로 한다.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void getAssignedRequests(controller.signal)
      .then(({ requests: list }) => {
        setRequests(list);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 배정 요청 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [account?.accountId]);

  return (
    <FlowShell
      flow="influencer"
      step={2}
      eyebrow="MY REQUESTS"
      title="내 배정 요청"
      description="STYLEMATE 01 계정에 배정된 요청만 표시합니다."
      actions={
        <>
          <span className="draft-state">◇ 다른 스타일메이트의 요청은 표시하지 않아요.</span>
          <button className="btn-secondary" type="button" onClick={() => navigate("/")}>로그아웃</button>
        </>
      }
    >
      {status === "loading" ? (
        <div className="soft-card" aria-live="polite">배정된 요청을 불러오는 중이에요.</div>
      ) : null}
      {status === "error" ? (
        <div className="soft-card" aria-live="polite">
          <p className="error-copy" style={{ display: "block" }}>배정 요청을 불러오지 못했어요.</p>
        </div>
      ) : null}
      {status === "success" && requests.length === 0 ? (
        <div className="soft-card" aria-live="polite">
          <p>아직 배정된 요청이 없어요.</p>
          <p className="helper">사용자가 부탁해요 카드를 보내면 여기에 표시돼요.</p>
        </div>
      ) : null}
      <div className="influencer-list">
        {requests.map((request) => (
          <button
            className="request-row"
            type="button"
            aria-label={`요청 ${request.delivered ? "전달 완료" : "작성 필요"}`}
            key={request.requestCardId}
            onClick={() => {
              // 상세 화면이 이 매칭 id로 사용자 진단 결과를 조회한다.
              dispatch({ type: "selectRequest", requestId: request.matchResultId });
              navigate(request.delivered ? "/influencer/delivered" : "/influencer/detail");
            }}
          >
            <span>
              <span className="request-meta">
                <span className="badge">{request.coachingType === "group" ? "2인 그룹" : "개인"}</span>
                <span className="badge blue">{request.tpoLabel}</span>
              </span>
              <h3>{request.coachingType === "group" ? "2인 그룹 코칭" : "개인 코칭"}</h3>
              <p>{sentAtLabel(request.sentAt)}</p>
            </span>
            <span className={request.delivered ? "state-done" : "state-needed"}>
              {request.delivered ? "전달 완료" : "작성 필요"} <span aria-hidden="true">›</span>
            </span>
          </button>
        ))}
      </div>
    </FlowShell>
  );
}

function isGroupDraft(draft: OutfitDraft): draft is GroupOutfitDraft {
  return "memberA" in draft;
}

export function InfluencerDetailScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();

  // 사용자가 실제로 입력한 값을 읽는다. 고정 문구를 쓰면 누가 무엇을 입력했든 같은 화면이 된다.
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultView | null>(null);
  const [diagnosisStatus, setDiagnosisStatus] =
    useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!state.activeRequestId) return;
    const controller = new AbortController();
    setDiagnosisStatus("loading");
    void getDiagnosisResult(state.activeRequestId, controller.signal)
      .then((result) => {
        setDiagnosis(result);
        setDiagnosisStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 진단 결과 조회 실패", error);
        setDiagnosisStatus("error");
      });
    return () => controller.abort();
  }, [state.activeRequestId]);

  const group = diagnosis ? diagnosis.coachingType === "group" : state.mode === "group";
  const initial = useMemo(() => {
    const saved = loadDraft("stylemate-01", state.activeRequestId);
    if (saved && isGroupDraft(saved) === group) return saved;
    return group ? groupDefault : personalDefault;
  }, [group, state.activeRequestId]);
  const [draft, setDraft] = useState<OutfitDraft>(initial);
  const [draftState, setDraftState] = useState("모든 변경사항 저장됨");
  const [modal, setModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reviewResult, setReviewResult] = useState<OutfitReviewResponse | null>(null);
  const draftValid = isValidOutfitDraft(draft);

  useEffect(() => {
    setReviewStatus("idle");
    setReviewResult(null);
    setDraftState("저장 중…");
    const timer = window.setTimeout(() => {
      saveDraft("stylemate-01", state.activeRequestId, draft);
      setDraftState("자동 저장됨");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draft, state.activeRequestId]);

  const startReview = async () => {
    setReviewStatus("loading");
    setReviewResult(null);
    try {
      const result = await reviewOutfit(toOutfitReviewRequest(draft));
      setReviewResult(result);
      setReviewStatus("success");
    } catch {
      setReviewStatus("error");
    }
  };

  const setPersonal = (
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => {
    if (!isGroupDraft(draft)) {
      setDraft({ ...draft, [key]: { ...draft[key], [field]: value } });
    }
  };
  const setGroup = (
    member: "memberA" | "memberB",
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => {
    if (isGroupDraft(draft)) {
      setDraft({
        ...draft,
        [member]: {
          ...draft[member],
          [key]: { ...draft[member][key], [field]: value },
        },
      });
    }
  };

  return (
    <>
      <FlowShell
        flow="influencer"
        step={3}
        eyebrow="REQUEST DETAIL"
        title="코디 카드 작성"
        description={
          diagnosis
            ? `${diagnosis.coachingType === "group" ? "2인 그룹 코칭" : "개인 코칭"} · ${diagnosis.tpoLabel}`
            : "요청 내용을 불러오는 중이에요."
        }
        actions={
          <>
            <span className="draft-state">{draftState}</span>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                saveDraft("stylemate-01", state.activeRequestId, draft);
                setDraftState("임시저장 완료");
              }}
            >
              임시저장
            </button>
            <button className="btn-primary" type="button" disabled={!draftValid} onClick={() => {
              setReviewStatus("idle");
              setReviewResult(null);
              setModal(true);
            }}>
              전달하기 <span aria-hidden="true">→</span>
            </button>
          </>
        }
      >
        <button className="btn-ghost compose-back" type="button" onClick={() => navigate("/influencer/requests")}>
          ← 배정 요청 목록
        </button>
        <section className="compose-section">
          <h2 className="section-title">스타일 진단 결과</h2>
          {diagnosisStatus === "loading" ? (
            <div className="soft-card" aria-live="polite">진단 결과를 불러오는 중이에요.</div>
          ) : null}
          {diagnosisStatus === "error" ? (
            <div className="soft-card" aria-live="polite">
              <p className="error-copy" style={{ display: "block" }}>진단 결과를 불러오지 못했어요.</p>
            </div>
          ) : null}
          {diagnosis ? (
            <>
              <div className="dark-card">
                <span className="badge">Style DNA</span>
                {/* AI2가 만든 한 줄 결과를 그대로 쓴다. */}
                <h3>{diagnosis.styleDnaSummary}</h3>
                {diagnosis.matchingPoints.length ? (
                  <ul>
                    {diagnosis.matchingPoints.map((point) => (
                      <li key={point.text}>{point.text}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="soft-card input-summary-card">
                <dl className="summary-list">
                  <div className="summary-row">
                    <dt>공통 조건</dt>
                    <dd>
                      {diagnosis.coachingType === "group" ? "2인 그룹 코칭" : "개인 코칭"}
                      {" · "}
                      {/* TPO는 내부 코드로 저장되고 화면에서만 라벨로 바꾼다. */}
                      {diagnosis.tpoLabel}
                      {diagnosis.groupCombination?.score != null
                        ? ` · 그룹 스타일 조합도 ${diagnosis.groupCombination.score}`
                        : ""}
                    </dd>
                  </div>
                  {diagnosis.members.map((member) => (
                    <div className="summary-row" key={member.memberLabel}>
                      <dt>
                        {member.memberLabel === "self"
                          ? "입력"
                          : `구성원 ${member.memberLabel}`}
                      </dt>
                      <dd>
                        {[
                          member.heightCm ? `${member.heightCm}cm` : null,
                          member.bodyType,
                          `${member.preferredStyle} / ${member.avoidedStyle}`,
                          member.fitConcerns.join(", "),
                          `${member.budgetLabel} · ${member.budgetApproach}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  ))}
                  {diagnosis.members.map((member) =>
                    member.keywords.length ? (
                      <div className="summary-row" key={`${member.memberLabel}-keywords`}>
                        <dt>
                          {member.memberLabel === "self"
                            ? "키워드"
                            : `${member.memberLabel} 키워드`}
                        </dt>
                        <dd>{member.keywords.join(" · ")}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </div>
            </>
          ) : null}
        </section>
        <section className="compose-section">
          <h2 className="section-title">부탁해요 카드</h2>
          <div className="request-letter">
            <p>{state.requestText[group ? "group" : "personal"]}</p>
            <div className="request-budget-line">
              <strong>요청 예산</strong>
              <span>
                {group
                  ? `P4 ${budgetRangeLabel(state.requestBudget.group.A.minCode, state.requestBudget.group.A.maxCode)} · P5 ${budgetRangeLabel(state.requestBudget.group.B.minCode, state.requestBudget.group.B.maxCode)}`
                  : budgetRangeLabel(state.requestBudget.personal.minCode, state.requestBudget.personal.maxCode)}
              </span>
            </div>
          </div>
        </section>
        <section className="compose-section">
          <h2 className="section-title">코디 카드 내용</h2>
          {!isGroupDraft(draft) ? (
            <OutfitFields
              values={draft}
              onChange={(key, field, value) => setPersonal(key, field, value)}
            />
          ) : (
            <div className="group-result-grid">
              <div className="soft-card">
                <h3>구성원 A · P4</h3>
                <OutfitFields values={draft.memberA} onChange={(key, field, value) => setGroup("memberA", key, field, value)} />
              </div>
              <div className="soft-card">
                <h3>구성원 B · P5</h3>
                <OutfitFields values={draft.memberB} onChange={(key, field, value) => setGroup("memberB", key, field, value)} />
              </div>
            </div>
          )}
          <label className="field">
            <span className="field-label">스타일메이트의 한마디</span>
            <textarea
              className="textarea"
              value={draft.message}
              onChange={(event) => setDraft({ ...draft, message: event.target.value })}
            />
          </label>
          {!draftValid ? (
            <p className="error-copy outfit-error" style={{ display: "block" }}>
              상의와 하의의 제품명, http:// 또는 https://로 시작하는 상품 링크를 모두 입력해 주세요.
            </p>
          ) : null}
        </section>
      </FlowShell>
      {modal ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deliver-title">
            <h2 id="deliver-title">코디 카드를 전달할까요?</h2>
            <p>안전 표현과 상의·하의 상품 링크 검수를 통과한 뒤에만 전달할 수 있어요.</p>
            {reviewStatus === "loading" ? <p aria-live="polite">코디 카드를 검수하고 있어요.</p> : null}
            {reviewStatus === "error" ? <p className="error-copy" style={{ display: "block" }}>검수를 완료하지 못했어요. 다시 시도해 주세요.</p> : null}
            {reviewResult ? <OutfitReviewPanel result={reviewResult} /> : null}
            <div className="modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setModal(false)}>계속 작성</button>
              <button
                className="btn-secondary"
                type="button"
                disabled={reviewStatus === "loading"}
                onClick={() => void startReview()}
              >
                {reviewStatus === "idle" ? "검수 시작" : "검수 다시 시도"}
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={reviewResult?.reviewStatus !== "pass"}
                onClick={() => {
                  if (reviewResult?.reviewStatus !== "pass") return;
                  clearDraft("stylemate-01", state.activeRequestId);
                  navigate("/influencer/delivered");
                }}
              >
                전달 확정
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OutfitFields({
  values,
  onChange,
}: {
  values: OutfitFieldValues;
  onChange: (
    key: "top" | "bottom",
    field: "name" | "url",
    value: string,
  ) => void;
}) {
  return (
    <>
      {([
        ["top", "상의"],
        ["bottom", "하의"],
      ] as const).map(([key, label]) => (
        <div className="product-fields" key={key}>
          <label className="field">
            <span className="field-label">{label} 제품명</span>
            <input
              className="text-input"
              aria-label={`${label} 제품명`}
              value={values[key].name}
              onChange={(event) => onChange(key, "name", event.target.value)}
            />
          </label>
          <label className={`field ${values[key].url && !isValidProductUrl(values[key].url) ? "is-error" : ""}`}>
            <span className="field-label">{label} 상품 링크</span>
            <input
              className="text-input"
              aria-label={`${label} 상품 링크`}
              type="url"
              placeholder="https://example.com/product"
              value={values[key].url}
              onChange={(event) => onChange(key, "url", event.target.value)}
            />
            {values[key].url && !isValidProductUrl(values[key].url) ? (
              <span className="error-copy" style={{ display: "block" }}>유효한 http/https 링크를 입력해 주세요.</span>
            ) : null}
          </label>
        </div>
      ))}
    </>
  );
}

export function DeliveredScreen() {
  const navigate = useNavigate();
  const { state } = useAppState();
  return (
    <FlowShell
      flow="influencer"
      step={4}
      eyebrow="DELIVERED · READ ONLY"
      title="전달 완료 코디 카드"
      description={`${state.activeRequestId} · 전달된 내용은 수정·삭제·재전송할 수 없습니다.`}
      actions={
        <button className="btn-primary" type="button" onClick={() => navigate("/influencer/requests")}>
          내 배정 요청으로 돌아가기
        </button>
      }
    >
      <button className="btn-ghost compose-back" type="button" onClick={() => navigate("/influencer/requests")}>← 배정 요청 목록</button>
      <div className="readonly-banner">◇ 읽기 전용으로 열람 중</div>
      <article className="outfit-card readonly-outfit-card">
        <div className="outfit-cover" role="img" aria-label="전달 완료된 등교 코디 이미지" />
        <div className="outfit-content">
          <div className="outfit-head">
            <div><span className="badge">등교·일상</span><h2>가볍고 단정한 데일리 레이어드</h2><p className="helper">STYLEMATE 01 · 3만~6만 원</p></div>
            <span className="badge dark">전달 완료</span>
          </div>
          <div className="item-list">
            <div className="item"><small>상의</small><strong>소프트 블루 가디건 + 화이트 티</strong><a href="https://example.com/products/blue-cardigan" target="_blank" rel="noreferrer">상품 링크 보기</a></div>
            <div className="item"><small>하의</small><strong>라이트 그레이 A라인 스커트</strong><a href="https://example.com/products/gray-skirt" target="_blank" rel="noreferrer">상품 링크 보기</a></div>
          </div>
          <div className="soft-card"><strong>보유 아이템 대체 팁</strong><p className="helper" style={{ marginTop: 7 }}>블루 가디건 대신 비슷한 채도의 셔츠를 열어 입어도 전체 인상이 유지돼요.</p></div>
          <div className="coach-message" style={{ marginTop: 14 }}><h3>P2님께 전한 말</h3><p>수업과 약속 사이에 오래 입어도 편하도록 가벼운 레이어드와 익숙한 스니커즈를 중심으로 구성했어요. 상의 색감만 맞추면 가지고 있는 아이템으로도 충분히 재현할 수 있어요.</p></div>
        </div>
      </article>
    </FlowShell>
  );
}
