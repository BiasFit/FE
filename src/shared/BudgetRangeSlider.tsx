import { budgetRangeLabel, budgets } from "../data/options";

interface BudgetRangeSliderProps {
  minCode: number;
  maxCode: number;
  onChange: (range: { minCode: number; maxCode: number }) => void;
}

export function BudgetRangeSlider({ minCode, maxCode, onChange }: BudgetRangeSliderProps) {
  const max = budgets.length;
  const minPercent = ((minCode - 1) / (max - 1)) * 100;
  const maxPercent = ((maxCode - 1) / (max - 1)) * 100;

  return (
    <div className="budget-range">
      <output className="budget-range-value" aria-live="polite">
        {budgetRangeLabel(minCode, maxCode)}
      </output>
      <div
        className="budget-range-track"
        style={{
          background: `linear-gradient(to right, var(--input) ${minPercent}%, var(--primary) ${minPercent}%, var(--primary) ${maxPercent}%, var(--input) ${maxPercent}%)`,
        }}
      >
        <input
          aria-label="최소 예산"
          type="range"
          min={1}
          max={max}
          step={1}
          value={minCode}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange({ minCode: next, maxCode: Math.max(next, maxCode) });
          }}
        />
        <input
          aria-label="최대 예산"
          type="range"
          min={1}
          max={max}
          step={1}
          value={maxCode}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange({ minCode: Math.min(minCode, next), maxCode: next });
          }}
        />
      </div>
      <div className="budget-range-ends" aria-hidden="true">
        <span>3만 원 미만</span>
        <span>18만 원 이상</span>
      </div>
      <p className="helper">상의 1개와 하의 1개 조합 기준 · 3만 원 단위</p>
    </div>
  );
}
