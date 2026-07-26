import type { ReactNode } from "react";
import { useAppState } from "../app/AppStateProvider";

const userSteps = [
  "시작",
  "Style DNA 입력",
  "진단 결과",
  "스타일메이트 매칭",
  "코디 카드",
];

const influencerSteps = [
  "로그인",
  "배정 요청",
  "코디 작성",
  "전달 확인",
];

interface FlowShellProps {
  flow?: "user" | "influencer";
  step: number;
  formStep?: number;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}

export function FlowShell({
  flow = "user",
  step,
  formStep,
  eyebrow,
  title,
  description,
  children,
  actions,
  wide,
}: FlowShellProps) {
  const labels = flow === "user" ? userSteps : influencerSteps;
  const contextTitle =
    flow === "user"
      ? step <= 2
        ? "나만의 스타일 기준을 만들어요."
        : step === 3
          ? "Style DNA를 한눈에 확인해요."
          : step === 4
            ? "나와 맞는 스타일 롤모델을 찾아요."
            : "고민을 코디 기준으로 바꿔요."
      : step <= 2
        ? "배정된 요청만 안전하게 확인해요."
        : "진단과 부탁을 한 화면에서 확인해요.";

  return (
    <section className="screen is-active">
      <div className="service-layout">
        <aside className="context-panel">
          <p className="context-brand">BiasFit</p>
          <p className="context-step">
            {flow === "user" ? "USER FLOW" : "INFLUENCER FLOW"} ·{" "}
            {String(step).padStart(2, "0")} / {labels.length}
          </p>
          <h2>{contextTitle}</h2>
          <ol className="context-list">
            {labels.map((label, index) => (
              <li
                className={`context-item ${index + 1 === step ? "active" : ""} ${index + 1 < step ? "done" : ""}`}
                key={label}
              >
                <span className="dot">{String(index + 1).padStart(2, "0")}</span>
                {label}
              </li>
            ))}
          </ol>
          <p className="safety-note">
            실제 개인정보 없이 팀이 만든 테스트 데이터로만 동작합니다.
          </p>
        </aside>
        <div className="work-panel" style={wide ? { width: "min(100%,900px)" } : undefined}>
          <div className="work-head">
            {formStep ? <Progress current={formStep} /> : null}
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1 className="page-title">{title}</h1>
            {description ? <p className="page-desc">{description}</p> : null}
          </div>
          <div className="work-body">{children}</div>
          {actions ? <div className="work-actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div className="progress-steps" aria-label={`입력 ${current}/5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`progress-step ${step === current ? "active" : ""} ${step < current ? "done" : ""}`}
        />
      ))}
    </div>
  );
}

export function MemberSwitch() {
  const { state, dispatch } = useAppState();
  if (state.mode !== "group") return null;
  return (
    <div className="member-switch" role="tablist" aria-label="구성원 선택">
      {(["A", "B"] as const).map((member) => (
        <button
          className={state.activeMember === member ? "selected" : ""}
          key={member}
          type="button"
          role="tab"
          aria-selected={state.activeMember === member}
          onClick={() => dispatch({ type: "setActiveMember", member })}
        >
          구성원 {member} · {state.group.members[member].personaId}
        </button>
      ))}
    </div>
  );
}

export function ChipChoices({
  values,
  selected,
  onChange,
  max,
}: {
  values: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (selected.length < max) onChange([...selected, value]);
  };

  return (
    <div className="chip-wrap selectable">
      {values.map((value) => (
        <button
          className={`chip ${selected.includes(value) ? "selected" : ""}`}
          type="button"
          aria-pressed={selected.includes(value)}
          key={value}
          onClick={() => toggle(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
