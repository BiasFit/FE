import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupOutfitDraft, OutfitFields as OutfitFieldValues, PersonalOutfitDraft } from "../../app/types";
import type { OutfitReviewResponse } from "../../domain/aiContracts";
import { useAppState } from "../../app/AppStateProvider";
import { budgetRangeLabel, fitConcerns, styleOptions, tpoLabel } from "../../data/options";
import { personaForms } from "../../data/personas";
import { isValidOutfitDraft, isValidProductUrl, toOutfitReviewRequest } from "../../domain/outfit";
import { reviewOutfit } from "../../lib/biasfitApi";
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
          <span className="field-label">테스트 이메일</span>
          <input className="text-input" type="email" defaultValue="stylemate01@biasfit.test" />
        </label>
        <label className="field">
          <span className="field-label">테스트 코드</span>
          <input className="text-input" type="password" defaultValue="mate01" />
        </label>
        <button className="btn-primary" type="button" onClick={() => navigate("/influencer/requests")}>
          로그인
        </button>
        <div className="divider">첫 로그인 테스트</div>
        <button className="btn-secondary" type="button" onClick={() => navigate("/influencer/profile")}>
          프로필 미완료 계정으로 시작
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
  const [budgetApproach, setBudgetApproach] = useState("가성비 중심");
  const [occasions, setOccasions] = useState([
    "개강·새학기",
    "등교·일상",
    "여행·사진",
  ]);
  const [coachingType, setCoachingType] = useState("개인·2인 그룹 모두");
  const [showError, setShowError] = useState(false);
  const profileTpos = [
    "개강·새학기",
    "등교·일상",
    "여행·사진",
    "데이트·소개팅",
    "발표·면접",
  ];
  const valid =
    primaryStyle !== secondaryStyle &&
    concerns.length > 0 &&
    occasions.length > 0;
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
        <SingleChoice values={["가성비 중심", "균형형", "품질·소재 우선", "투자 아이템 중심"]} selected={budgetApproach} onChange={setBudgetApproach} />
      </div>
      <div className="field">
        <div className="field-label">코칭 강점 TPO <span className="required">최대 5개</span></div>
        <ChipChoices values={profileTpos} selected={occasions} max={5} onChange={setOccasions} />
      </div>
      <div className="field">
        <div className="field-label">지원 코칭 유형 <span className="required">1개</span></div>
        <SingleChoice values={["개인 코칭만", "2인 그룹 코칭만", "개인·2인 그룹 모두"]} selected={coachingType} onChange={setCoachingType} />
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
}: {
  values: readonly string[];
  selected: string;
  onChange: (value: string) => void;
  disabled?: string;
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
          {value}
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

export function InfluencerRequestsScreen() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const activeRequests = state.activeRequestId
    ? [{
        id: state.activeRequestId,
        mode: state.mode === "group" ? "2인 그룹" : "개인",
        tpo: state.mode === "group" ? state.group.tpo : state.personal.tpo,
        detail: "방금 전 생성된 부탁해요 카드",
        done: false,
      }]
    : [];
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
      <div className="influencer-list">
        {activeRequests.map((request) => (
          <button
            className="request-row"
            type="button"
            aria-label={`${request.id} 요청 ${request.done ? "전달 완료" : "작성 필요"}`}
            key={request.id}
            onClick={() => {
              dispatch({ type: "selectRequest", requestId: request.id });
              navigate(request.done ? "/influencer/delivered" : "/influencer/detail");
            }}
          >
            <span>
              <span className="request-meta">
                <span className="badge">{request.mode}</span>
                <span className="badge blue">{tpoLabel(request.tpo)}</span>
              </span>
              <h3>{request.id}</h3>
              <p>{request.detail}</p>
            </span>
            <span className={request.done ? "state-done" : "state-needed"}>
              {request.done ? "전달 완료" : "작성 필요"} <span aria-hidden="true">›</span>
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
  const group = state.mode === "group";
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
        description={`${state.activeRequestId} · ${group ? "2인 그룹 코칭 · 여행·사진" : "개인 코칭 · 개강·새학기"}`}
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
          <div className="dark-card">
            <span className="badge">Style DNA</span>
            <h3>{group ? "서로 다른 취향을 잇는 여행 시밀러 밸런스" : "부드럽고 단정한 캠퍼스 밸런스"}</h3>
            <p>
              {group
                ? "P4 캐주얼 75 · P5 오피스 75 · 그룹 스타일 조합도 61"
                : "로맨틱 75 · 웨이브 · 전체 기장/비율 · 3만~6만 원"}
            </p>
          </div>
          <div className="soft-card input-summary-card">
            {group ? (
              <dl className="summary-list">
                <div className="summary-row"><dt>공통 조건</dt><dd>친구 · 여행·사진 · 그룹 스타일 조합도 61</dd></div>
                <div className="summary-row"><dt>P4 입력</dt><dd>157cm · 웨이브 · 캐주얼 · 하의 길이/비율 · 3만~6만 원</dd></div>
                <div className="summary-row"><dt>P5 입력</dt><dd>165cm · 내추럴 · 오피스 & 비즈니스캐주얼 · 상체 여유/어깨선 · 6만~9만 원</dd></div>
              </dl>
            ) : (
              <dl className="summary-list">
                <div className="summary-row"><dt>체형·핏</dt><dd>{personaForms.P1.height}cm · S / S · 웨이브 · 밑위·하의 길이, 전체 기장·비율</dd></div>
                <div className="summary-row"><dt>선호 / 비선호</dt><dd>로맨틱 / 스트릿</dd></div>
                <div className="summary-row"><dt>키워드</dt><dd>부드러운 · 사랑스러운 · 자연스러운</dd></div>
                <div className="summary-row"><dt>예산·TPO</dt><dd>3만~6만 원 · 가성비 중심 · 개강·새학기</dd></div>
              </dl>
            )}
          </div>
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
