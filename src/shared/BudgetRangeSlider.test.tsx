import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetRangeSlider } from "./BudgetRangeSlider";

describe("BudgetRangeSlider", () => {
  it("shows and updates a minimum and maximum budget range", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider minCode={2} maxCode={3} onChange={onChange} />);

    expect(screen.getByText("3만 원~9만 원")).toBeVisible();

    const minimumSlider = screen.getByRole("slider", { name: "최소 예산" });
    fireEvent.focus(minimumSlider);
    fireEvent.keyDown(minimumSlider, {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith({ minCode: 3, maxCode: 3 });

    const maximumSlider = screen.getByRole("slider", { name: "최대 예산" });
    fireEvent.focus(maximumSlider);
    fireEvent.keyDown(maximumSlider, {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith({ minCode: 2, maxCode: 2 });
  });
});
