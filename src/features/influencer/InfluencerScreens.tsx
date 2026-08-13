import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupOutfitDraft, OutfitFields as OutfitFieldValues, PersonalOutfitDraft } from "../../app/types.js";
import type { OutfitReviewResponse } from "../../domain/aiContracts.js";
import { useAppState } from "../../app/AppStateProvider.js";
import { useAuth } from "../../app/AuthProvider.js";
import {
  TPO_CODES,
  budgetApproaches,
  fitConcerns,
  styleOptions,
  tpoLabel,
} from "../../data/options.js";
import type { CoachingSupport } from "../../domain/scoring.js";
import { isValidOutfitDraft, isValidProductUrl, toOutfitReviewRequest } from "../../domain/outfit.js";
import {
  deliverOutfitCard,
  getAssignedRequests,
  getDiagnosisResult,
  getOutfitCard,
  saveInfluencerProfile,
  type AssignedRequestView,
  type DiagnosisResultView,
  type OutfitCardView,
} from "../../lib/biasfitApi.js";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type OutfitDraft,
} from "../../storage/drafts.js";
import { ChipChoices, FlowShell } from "../../shared/FlowShell.js";
import { BudgetRangeSlider } from "../../shared/BudgetRangeSlider.js";
import { OutfitReviewPanel } from "./OutfitReviewPanel.js";

/**
 * 빈 초안으로 시작한다.
 *
 * 예시 제품명과 example.com 링크를 미리 채워 두면 인플루언서가 그대로 전달했을 때
 * 사용자에게 존재하지 않는 상품이 간다. 작성은 반드시 빈 칸에서 시작해야 한다.
 */
const emptyProduct = { name: "", url: "" };

const personalDefault: PersonalOutfitDraft = {
  title: "",
  top: { ...emptyProduct },
  bottom: { ...emptyProduct },
  message: "",
};

const groupDefault: GroupOutfitDraft = {
  memberA: { top: { ...emptyProduct }, bottom: { ...emptyProduct } },
  memberB: { top: { ...emptyProduct }, bottom: { ...emptyProduct } },
  title: "",
  message: "",
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
          사전에 안내된 개인 테스트 계정으로
          <br />
          로그인해 주세요.
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
  personal_only: "개인 스타일링만",
  group_only: "2인 그룹 스타일링만",
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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
          사용자와의 매칭에 활용될
          <br />
          스타일링 정보를 입력해 주세요.
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
            disabled={saving}
            onClick={() => {
              if (!valid) {
                setShowError(true);
                return;
              }
              setSaving(true);
              setSaveError("");
              // 서버에 저장해야 매칭 후보가 된다. localStorage에만 두면 아무도 찾지 못한다.
              void saveInfluencerProfile({
                primaryStyle,
                secondaryStyle,
                bodyType,
                fitConcerns: concerns,
                budgetMinCode,
                budgetMaxCode,
                budgetApproach,
                tpos: occasions,
                coachingType,
              })
                .then(() => navigate("/influencer/requests"))
                .catch((error: unknown) => {
                  setSaveError(
                    error instanceof Error ? error.message : "프로필을 저장하지 못했어요.",
                  );
                  setSaving(false);
                });
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
        <div className="field-label">지원 스타일링 유형 <span className="required">1개</span></div>
        <SingleChoice
          values={Object.keys(COACHING_TYPE_LABEL)}
          selected={coachingType}
          onChange={(value) => setCoachingType(value as CoachingSupport)}
          labelFor={(value) => COACHING_TYPE_LABEL[value as CoachingSupport]}
        />
      </div>
      {showError && !valid ? <p className="error-copy" style={{ display: "block" }}>필수 항목을 모두 선택해 주세요.</p> : null}
      {saveError ? <p className="error-copy" style={{ display: "block" }} aria-live="polite">{saveError}</p> : null}
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
      title="스타일링 요청 목록"
      description={`${account?.displayName ?? "내"} 계정에 배정된 요청만 표시합니다.`}
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
              <h3>{request.coachingType === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}</h3>
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
  const { account } = useAuth();
  // 임시저장은 로그인한 계정 것만 열린다. 고정 id를 쓰면 다른 사람의 초안이 열린다.
  const draftOwner = account?.loginId ?? "unknown";

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
    const saved = loadDraft(draftOwner, state.activeRequestId);
    if (saved && isGroupDraft(saved) === group) return saved;
    return group ? groupDefault : personalDefault;
  }, [draftOwner, group, state.activeRequestId]);
  const [draft, setDraft] = useState<OutfitDraft>(initial);
  const [draftState, setDraftState] = useState("모든 변경사항 저장됨");
  const [modal, setModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reviewResult, setReviewResult] = useState<OutfitReviewResponse | null>(null);
  const [deliverError, setDeliverError] = useState("");
  const draftValid = isValidOutfitDraft(draft);

  useEffect(() => {
    setReviewStatus("idle");
    setReviewResult(null);
    setDeliverError("");
    setDraftState("저장 중…");
    const timer = window.setTimeout(() => {
      saveDraft(draftOwner, state.activeRequestId, draft);
      setDraftState("자동 저장됨");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draft, draftOwner, state.activeRequestId]);

  /**
   * 전달은 서버 한 곳에서만 일어난다.
   *
   * 검수(링크·안전 표현)와 저장이 같은 요청 안에서 순서대로 돌기 때문에,
   * "검수는 통과했는데 저장이 안 된" 상태나 그 반대가 생기지 않는다.
   * 통과하지 못하면 서버는 아무것도 저장하지 않고 검수 내역만 돌려준다.
   */
  const deliver = async () => {
    setReviewStatus("loading");
    setReviewResult(null);
    setDeliverError("");
    try {
      const request = toOutfitReviewRequest(draft);
      const result = await deliverOutfitCard({
        matchResultId: state.activeRequestId,
        title: draft.title,
        message: draft.message,
        cards: request.cards,
      });
      setReviewResult(result.review);
      setReviewStatus("success");
      if (result.delivered) {
        // 전달됐으니 이 요청의 임시저장은 지운다 (INFLUENCER_SCREEN_SPEC.md 3.4).
        clearDraft(draftOwner, state.activeRequestId);
        navigate("/influencer/delivered");
      }
    } catch (error) {
      setReviewStatus("error");
      setDeliverError(
        error instanceof Error ? error.message : "코디 카드를 전달하지 못했어요.",
      );
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
            ? `${diagnosis.coachingType === "group" ? "2인 그룹 스타일링" : "개인 스타일링"} · ${diagnosis.tpoLabel}`
            : "요청 내용을 불러오는 중이에요."
        }
        actions={
          <>
            <span className="draft-state">{draftState}</span>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                saveDraft(draftOwner, state.activeRequestId, draft);
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
                      {diagnosis.coachingType === "group" ? "2인 그룹 스타일링" : "개인 스타일링"}
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
            {/* 사용자가 보낸 원문이다. 브라우저 로컬 값을 읽으면 다른 기기에서 빈 화면이 된다. */}
            <p>
              {diagnosis?.requestCard?.messageText ||
                (diagnosisStatus === "loading"
                  ? "요청 내용을 불러오는 중이에요."
                  : "전달된 요청 내용이 없어요.")}
            </p>
            <div className="request-budget-line">
              <strong>요청 예산</strong>
              {/* 예산은 요청 정보라서 인플루언서가 수정하지 않는다 (INFLUENCER_SCREEN_SPEC.md 3.4). */}
              <span>
                {diagnosis?.members
                  .map((member) =>
                    member.memberLabel === "self"
                      ? member.budgetLabel
                      : `${member.memberLabel} ${member.budgetLabel}`,
                  )
                  .join(" · ") || "—"}
              </span>
            </div>
          </div>
        </section>
        <section className="compose-section">
          <h2 className="section-title">코디 카드 내용</h2>
          <label className="field">
            <span className="field-label">코디 카드 제목 <span className="required">필수</span></span>
            <input
              className="text-input"
              aria-label="코디 카드 제목"
              placeholder="예: 부드러운 캠퍼스 레이어드"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
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
              코디 카드 제목, 전하는 말, 상의·하의의 제품명과 http:// 또는 https://로 시작하는 상품 링크를 모두 입력해 주세요.
            </p>
          ) : null}
        </section>
      </FlowShell>
      {modal ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deliver-title">
            <h2 id="deliver-title">코디 카드를 전달할까요?</h2>
            <p>안전 표현과 상의·하의 상품 링크 검수를 통과한 뒤에만 전달돼요. 전달 후에는 수정하거나 다시 보낼 수 없어요.</p>
            <div className="soft-card">
              <strong>{draft.title}</strong>
              <p className="helper">{draft.message}</p>
            </div>
            {reviewStatus === "loading" ? <p aria-live="polite">코디 카드를 확인하고 있어요.</p> : null}
            {reviewStatus === "error" ? (
              <p className="error-copy" style={{ display: "block" }} aria-live="polite">
                {deliverError || "코디 카드를 전달하지 못했어요. 다시 시도해 주세요."}
              </p>
            ) : null}
            {reviewResult && reviewResult.reviewStatus !== "pass" ? (
              <>
                <OutfitReviewPanel result={reviewResult} />
                <p className="helper">
                  {/* operations_review는 인플루언서 잘못이 아니다 (INFLUENCER_SCREEN_SPEC.md 3.4). */}
                  {reviewResult.reviewStatus === "operations_review"
                    ? "자동 접속 확인이 막혀 운영진이 확인하고 있어요. 작성한 내용은 그대로 유지했어요."
                    : "수정한 뒤 다시 전달해 주세요. 작성한 내용은 그대로 유지했어요."}
                </p>
              </>
            ) : null}
            <div className="modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setModal(false)}>계속 작성</button>
              <button
                className="btn-primary"
                type="button"
                disabled={reviewStatus === "loading" || !draftValid}
                onClick={() => void deliver()}
              >
                {reviewStatus === "loading"
                  ? "전달하는 중이에요."
                  : reviewResult || deliverError
                    ? "수정 후 다시 전달"
                    : "전달 확정"}
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
  const [card, setCard] = useState<OutfitCardView | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // 전달한 카드를 서버에서 다시 읽는다. 화면에 남은 초안을 보여주면
  // 실제로 전달된 내용과 달라질 수 있다.
  useEffect(() => {
    if (!state.activeRequestId) {
      setStatus("success");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void getOutfitCard(state.activeRequestId, controller.signal)
      .then((result) => {
        setCard(result.card);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 인플루언서] 코디 카드 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [state.activeRequestId]);

  return (
    <FlowShell
      flow="influencer"
      step={4}
      eyebrow="DELIVERED · READ ONLY"
      title="전달 완료 코디 카드"
      description="전달된 내용은 수정·삭제·재전송할 수 없습니다."
      actions={
        <button className="btn-primary" type="button" onClick={() => navigate("/influencer/requests")}>
          내 배정 요청으로 돌아가기
        </button>
      }
    >
      <button className="btn-ghost compose-back" type="button" onClick={() => navigate("/influencer/requests")}>← 배정 요청 목록</button>
      <div className="readonly-banner">◇ 읽기 전용으로 열람 중</div>
      {status === "loading" ? (
        <div className="soft-card" aria-live="polite">전달한 코디 카드를 불러오는 중이에요.</div>
      ) : null}
      {status === "error" ? (
        <div className="soft-card" aria-live="polite">
          <p className="error-copy" style={{ display: "block" }}>전달된 코디 카드 정보를 불러오지 못했어요.</p>
        </div>
      ) : null}
      {status === "success" && !card ? (
        <div className="soft-card" aria-live="polite">
          <p>아직 전달된 코디 카드가 없어요.</p>
        </div>
      ) : null}
      {card ? <DeliveredOutfitCard card={card} /> : null}
      <p className="helper" style={{ marginTop: 12 }}>
        코디 카드는 전달 후 수정할 수 없어요. 이 요청의 임시저장은 삭제됐어요.
      </p>
    </FlowShell>
  );
}

/** 전달된 카드를 읽기 전용으로 그린다. 인플루언서와 사용자가 같은 내용을 본다. */
export function DeliveredOutfitCard({ card }: { card: OutfitCardView }) {
  const members: Array<"self" | "A" | "B"> =
    card.coachingType === "group" ? ["A", "B"] : ["self"];

  return (
    <>
      <div className={card.coachingType === "group" ? "group-result-grid" : ""}>
        {members.map((memberLabel) => {
          const items = card.items.filter((item) => item.memberLabel === memberLabel);
          const top = items.find((item) => item.itemType === "top");
          const bottom = items.find((item) => item.itemType === "bottom");
          return (
            <article className="outfit-card readonly-outfit-card" key={memberLabel}>
              <div className="outfit-cover" role="img" aria-label={`${card.title} 코디 이미지`} />
              <div className="outfit-content">
                <div className="outfit-head">
                  <div>
                    <span className="badge">{card.tpoLabel}</span>
                    <h2>{card.title}</h2>
                    <p className="helper">
                      {card.influencerName} · {card.budgetLabel} · {card.budgetApproach}
                    </p>
                  </div>
                  <span className="badge dark">
                    {memberLabel === "self" ? "개인 스타일링" : `구성원 ${memberLabel}`}
                  </span>
                </div>
                <div className="item-list">
                  {([["상의", top], ["하의", bottom]] as const).map(([label, item]) => (
                    <div className="item" key={label}>
                      <small>{label}</small>
                      <strong>{item?.name ?? "—"}</strong>
                      {item ? (
                        <a href={item.url} target="_blank" rel="noreferrer">상품 링크 보기</a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="coach-message" style={{ marginTop: 14 }}>
        <h3>전한 말</h3>
        <p>{card.message}</p>
      </div>
    </>
  );
}
