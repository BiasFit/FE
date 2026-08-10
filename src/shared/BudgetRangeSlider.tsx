import { budgetRangeLabel, budgets } from "../data/options";
import { Slider } from "../components/ui/slider";

interface BudgetRangeSliderProps {
  minCode: number;
  maxCode: number;
  onChange: (range: { minCode: number; maxCode: number }) => void;
}

export function BudgetRangeSlider({ minCode, maxCode, onChange }: BudgetRangeSliderProps) {
  const sliderValue: [number, number] = [minCode - 1, maxCode];
  const boundaryLabels = [
    "3만 원 미만",
    "3만 원",
    "6만 원",
    "9만 원",
    "12만 원",
    "15만 원",
    "18만 원",
    "18만 원 이상",
  ];

  return (
    <div className="budget-range">
      <output className="budget-range-value" aria-live="polite">
        {budgetRangeLabel(minCode, maxCode)}
      </output>
      <Slider
        value={sliderValue}
        min={0}
        max={budgets.length}
        step={1}
        minStepsBetweenThumbs={1}
        thumbLabels={["최소 예산", "최대 예산"]}
        className="budget-range-slider"
        onValueChange={([start, end]) =>
          onChange({ minCode: start + 1, maxCode: end })
        }
      />
      <div className="budget-range-boundaries" aria-hidden="true">
        {boundaryLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <p className="helper">상의 1개와 하의 1개 조합 기준 · 3만 원 단위</p>
    </div>
  );
}
