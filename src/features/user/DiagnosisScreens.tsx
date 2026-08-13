import { useNavigate } from "react-router-dom";
import type { DiagnosisForm } from "../../app/types.js";
import { useAppState } from "../../app/AppStateProvider.js";
import {
  avoidedElements,
  bodyTypes,
  budgetApproaches,
  designElements,
  fitConcerns,
  keywords,
  preferredItems,
  styleOptions,
  TPO_OPTIONS,
  type TpoCode,
} from "../../data/options.js";
import { ChipChoices, FlowShell, MemberSwitch } from "../../shared/FlowShell.js";
import { BudgetRangeSlider } from "../../shared/BudgetRangeSlider.js";
import { PriorityQuestion } from "./PriorityQuestion.js";

function useCurrentDiagnosis() {
  const { state, dispatch } = useAppState();
  const form =
    state.mode === "personal"
      ? state.personal
      : state.group.members[state.activeMember];
  const update = (patch: Partial<DiagnosisForm>) => {
    if (state.mode === "personal") {
      dispatch({ type: "updatePersonal", patch });
    } else {
      dispatch({
        type: "updateGroupMember",
        member: state.activeMember,
        patch,
      });
    }
  };
  return { state, dispatch, form, update };
}

function Actions({
  back,
  next,
  nextLabel,
  disabled = false,
}: {
  back: string;
  next: string;
  nextLabel: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <>
      <button className="btn-ghost" type="button" onClick={() => navigate(back)}>
        이전
      </button>
      <button
        className="btn-primary"
        type="button"
        disabled={disabled}
        onClick={() => navigate(next)}
      >
        {nextLabel} <span aria-hidden="true">→</span>
      </button>
    </>
  );
}

export function BodyScreen() {
  const { state, dispatch, form, update } = useCurrentDiagnosis();

  return (
    <FlowShell
      step={2}
      formStep={1}
      eyebrow="입력 1 / 5 · 체형과 핏"
      title={
        <>
          옷을 고를 때 고민되는
          <br />
          핏을 알려주세요.
        </>
      }
      description="체형 정보는 스타일 선택을 돕는 참고 기준으로만 사용해요."
      actions={
        <Actions
          back="/user/coaching"
          next="/user/style"
          nextLabel="취향 입력하기"
          disabled={
            state.mode === "group" &&
            state.group.relationship === "other" &&
            !state.group.relationshipOther.trim()
          }
        />
      }
    >
      {state.mode === "group" ? (
        <div className="soft-card" style={{ marginBottom: 20 }}>
          <h2 className="sub-title">함께 코칭받을 두 사람</h2>
          <p className="helper">
            관계와 공통 약속을 먼저 정하고 구성원별 정보를 입력해요.
          </p>
          <div className="field-row" style={{ marginTop: 14 }}>
            <select
              className="select-input"
              aria-label="관계 유형"
              value={state.group.relationship}
              onChange={(event) =>
                dispatch({
                  type: "updateGroup",
                  patch: {
                    relationship: event.target.value as
                      | "friend"
                      | "family"
                      | "other",
                  },
                })
              }
            >
              <option value="friend">친구</option>
              <option value="family">가족</option>
              <option value="other">기타</option>
            </select>
            <select
              className="select-input"
              aria-label="약속 TPO"
              value={state.group.tpo}
              onChange={(event) =>
                dispatch({
                  type: "updateGroup",
                  patch: { tpo: event.target.value as TpoCode },
                })
              }
            >
              {TPO_OPTIONS.map((tpo) => (
                <option key={tpo.code} value={tpo.code}>{tpo.label}</option>
              ))}
            </select>
          </div>
          {state.group.relationship === "other" ? (
            <label className="field">
              <span className="field-label">관계를 직접 입력해 주세요</span>
              <input
                className="text-input"
                value={state.group.relationshipOther}
                placeholder="예: 룸메이트, 동아리 친구"
                onChange={(event) =>
                  dispatch({
                    type: "updateGroup",
                    patch: { relationshipOther: event.target.value },
                  })
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <MemberSwitch />
      <div className="field-row">
        <label className="field">
          <span className="field-label">
            키 <span className="required">필수</span>
          </span>
          <input
            aria-label="키"
            className="text-input"
            type="number"
            min={130}
            max={200}
            value={form.height}
            onChange={(event) => update({ height: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field-label">상의 사이즈</span>
          <select
            className="select-input"
            value={form.topSize}
            onChange={(event) => update({ topSize: event.target.value })}
          >
            {["S", "S~M", "M", "L"].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">하의 사이즈</span>
          <select
            className="select-input"
            value={form.bottomSize}
            onChange={(event) => update({ bottomSize: event.target.value })}
          >
            {["S", "M", "L"].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <div className="field-label choice-title">
          체형 유형 <span className="choice-count">1개 선택</span>
        </div>
        <div className="body-type-grid" role="radiogroup" aria-label="체형 유형">
          {bodyTypes.map((bodyType) => (
            <button
              className={`option-card body-type-card ${form.bodyType === bodyType.name ? "selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={form.bodyType === bodyType.name}
              key={bodyType.name}
              onClick={() => update({ bodyType: bodyType.name })}
            >
              <span className="body-visual" role="img" aria-label={`${bodyType.name} 체형 설명 일러스트`}>
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <rect width="180" height="180" rx="18" fill={bodyType.tone} />
                  <circle cx="90" cy="27" r="13" fill="#FFE6D9" stroke="#25355F" strokeWidth="3" />
                  <path d="M67 44c11-13 35-13 46 0l-9 35 18 62H58l18-62z" fill="#fff" stroke="#25355F" strokeWidth="3" />
                  <path d="M60 51l18 27M120 51l-18 27" stroke="#665EFD" strokeWidth="3" />
                </svg>
              </span>
              <span className="body-type-copy">
                <strong>{bodyType.name}</strong>
                <p>{bodyType.description}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="field-label">
          주요 핏 고민 <span className="required">최대 2개</span>
        </div>
        <ChipChoices
          values={fitConcerns}
          selected={form.fitConcerns}
          max={2}
          onChange={(fitConcerns) => update({ fitConcerns })}
        />
      </div>
      <label className="field">
        <span className="field-label">
          조금 더 알려주기 <span className="caption">선택</span>
        </span>
        <textarea
          className="textarea"
          value={form.fitNote}
          onChange={(event) => update({ fitNote: event.target.value })}
        />
      </label>
    </FlowShell>
  );
}

export function StyleScreen() {
  const { form, update } = useCurrentDiagnosis();
  return (
    <FlowShell
      step={2}
      formStep={2}
      eyebrow="입력 2 / 5 · 취향 정보"
      title={
        <>
          가장 끌리는 스타일은
          <br />
          무엇인가요?
        </>
      }
      description="설명과 이미지를 보고 가장 가까운 한 가지를 골라주세요."
      actions={
        <Actions back="/user/body" next="/user/signals" nextLabel="세부 취향 고르기" />
      }
    >
      <MemberSwitch />
      <div className="field">
        <div className="field-label">
          선호 스타일 <span className="required">1개 선택</span>
        </div>
        <div className="style-grid" role="radiogroup" aria-label="선호 스타일">
          {styleOptions.map((style) => (
            <button
              className={`style-card ${form.preferredStyle === style.name ? "selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={form.preferredStyle === style.name}
              key={style.name}
              onClick={() => {
                if (style.name !== form.avoidedStyle) {
                  update({ preferredStyle: style.name });
                }
              }}
            >
              <span className="check" aria-hidden="true">✓</span>
              <span className="style-photo" />
              <span className="style-copy">
                <strong>{style.name}</strong>
                <small>{style.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="avoid-style-panel">
        <div className="field-label choice-title">
          이번 코디에서 피하고 싶은 분위기 <span className="choice-count">1개 선택</span>
        </div>
        <p className="helper">선호 스타일과 같은 항목은 선택할 수 없어요.</p>
        <div className="chip-wrap" style={{ marginTop: 12 }}>
          {styleOptions.map((style) => (
            <button
              className={`chip ${form.avoidedStyle === style.name ? "selected" : ""}`}
              type="button"
              disabled={form.preferredStyle === style.name}
              key={style.name}
              onClick={() => update({ avoidedStyle: style.name })}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>
    </FlowShell>
  );
}

export function SignalsScreen() {
  const { form, update } = useCurrentDiagnosis();
  const groups = [
    ["선호 키워드", keywords, form.keywords, "keywords"],
    ["선호 디자인 요소", designElements, form.designElements, "designElements"],
    ["선호 아이템", preferredItems, form.preferredItems, "preferredItems"],
  ] as const;

  return (
    <FlowShell
      step={2}
      formStep={3}
      eyebrow="입력 3 / 5 · 세부 취향"
      title={
        <>
          내가 좋아하는 느낌을
          <br />
          조금 더 구체적으로 골라요.
        </>
      }
      description="각 영역에서 필수로 3가지씩 선택하면 Style DNA가 더 선명해져요."
      actions={
        <Actions
          back="/user/style"
          next="/user/budget"
          nextLabel="예산 입력하기"
          disabled={
            form.keywords.length !== 3 ||
            form.designElements.length !== 3 ||
            form.preferredItems.length !== 3
          }
        />
      }
    >
      <MemberSwitch />
      {groups.map(([label, values, selected, key]) => (
        <div className="field" key={key}>
          <div className="field-label choice-title">
            {label} <span className="choice-count">3개 선택 필수</span>
          </div>
          <ChipChoices
            values={values}
            selected={[...selected]}
            max={3}
            onChange={(next) => update({ [key]: next })}
          />
          <p className="selection-status">
            {selected.length === 3 ? "3개 선택 완료" : `${selected.length}/3 선택`}
          </p>
        </div>
      ))}
      <div className="field">
        <div className="field-label">
          피하고 싶은 요소 <span className="caption">0~3개</span>
        </div>
        <ChipChoices
          values={avoidedElements}
          selected={form.avoidedElements}
          max={3}
          onChange={(next) => update({ avoidedElements: next })}
        />
      </div>
    </FlowShell>
  );
}

export function BudgetScreen() {
  const { form, update } = useCurrentDiagnosis();
  return (
    <FlowShell
      step={2}
      formStep={4}
      eyebrow="입력 4 / 5 · 예산"
      title={
        <>
          코디 1세트 기준
          <br />
          예산을 알려주세요.
        </>
      }
      description="상의 1개와 하의 1개 조합의 최소·최고 금액을 선택해요."
      actions={<Actions back="/user/signals" next="/user/tpo" nextLabel="마지막 조건 고르기" />}
    >
      <MemberSwitch />
      <div className="field">
        <div className="field-label">원하는 가격대</div>
        <BudgetRangeSlider
          minCode={form.budgetMinCode}
          maxCode={form.budgetMaxCode}
          onChange={({ minCode, maxCode }) =>
            update({
              budgetMinCode: minCode,
              budgetMaxCode: maxCode,
              budgetCode: Math.round((minCode + maxCode) / 2),
            })
          }
        />
      </div>
      <div className="field">
        <div className="field-label">예산 접근 방식</div>
        <div className="card-grid" role="radiogroup" aria-label="예산 접근 방식">
          {budgetApproaches.map((approach) => (
            <button
              className={`option-card ${form.budgetApproach === approach ? "selected" : ""}`}
              role="radio"
              aria-checked={form.budgetApproach === approach}
              type="button"
              key={approach}
              onClick={() => update({ budgetApproach: approach })}
            >
              <strong>{approach}</strong>
              <span style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                {{
                  "총액 절약형": "정한 총예산 안에서 꼭 필요한 조합을 우선해요.",
                  "일상 활용형": "학교와 일상에서 자주 활용할 수 있는 구성을 우선해요.",
                  "소재·품질 우선형": "조금 더 투자해도 소재와 완성도를 먼저 봐요.",
                  "포인트 아이템 투자형": "오래 입을 핵심 포인트 아이템에 예산을 집중해요.",
                }[approach]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </FlowShell>
  );
}

export function TpoScreen() {
  const navigate = useNavigate();
  const { state, dispatch, form, update } = useCurrentDiagnosis();
  const value = state.mode === "group" ? state.group.tpo : form.tpo;
  const setValue = (tpo: TpoCode) => {
    if (state.mode === "group") {
      dispatch({ type: "updateGroup", patch: { tpo } });
    } else {
      update({ tpo });
    }
  };
  return (
    <FlowShell
      step={2}
      formStep={5}
      eyebrow="입력 5 / 5 · TPO"
      title={
        <>
          어떤 순간에 입을
          <br />
          코디가 필요한가요?
        </>
      }
      description="지금 가장 필요한 상황 한 가지를 골라주세요."
      actions={
        <>
          <button className="btn-ghost" type="button" onClick={() => navigate("/user/budget")}>
            이전
          </button>
          <button
            className="btn-primary"
            type="button"
            disabled={!state.matchPriority || state.priorityStatus !== "success"}
            onClick={() => navigate("/user/loading")}
          >
            Style DNA 결과 보기 <span aria-hidden="true">→</span>
          </button>
        </>
      }
    >
      <MemberSwitch />
      <div className="card-grid" role="radiogroup" aria-label="TPO">
        {TPO_OPTIONS.map((tpo) => (
          <button
            className={`option-card ${value === tpo.code ? "selected" : ""}`}
            type="button"
            role="radio"
            aria-checked={value === tpo.code}
            key={tpo.code}
            onClick={() => setValue(tpo.code)}
          >
            <strong>{tpo.label}</strong>
            <p>대학생활의 실제 선택 장면</p>
          </button>
        ))}
      </div>
      <PriorityQuestion
        request={{
          mode: state.mode,
          personal: state.personal,
          group: state.group,
        }}
      />
      <div className="soft-card">
        <strong>입력한 정보는 이렇게 사용해요</strong>
        <p className="helper" style={{ marginTop: 7 }}>
          입력한 정보는 추천 이유를 만드는 데만 사용돼요.
        </p>
      </div>
    </FlowShell>
  );
}
