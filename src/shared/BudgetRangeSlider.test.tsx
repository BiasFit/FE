import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetRangeSlider } from "./BudgetRangeSlider";

describe("BudgetRangeSlider", () => {
  it("shows and updates a minimum and maximum budget range", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider minCode={2} maxCode={3} onChange={onChange} />);

    expect(screen.getByText("3만~9만 원")).toBeVisible();

    fireEvent.change(screen.getByRole("slider", { name: "최소 예산" }), {
      target: { value: "4" },
    });
    expect(onChange).toHaveBeenCalledWith({ minCode: 4, maxCode: 4 });

    fireEvent.change(screen.getByRole("slider", { name: "최대 예산" }), {
      target: { value: "1" },
    });
    expect(onChange).toHaveBeenCalledWith({ minCode: 1, maxCode: 1 });
  });
});
