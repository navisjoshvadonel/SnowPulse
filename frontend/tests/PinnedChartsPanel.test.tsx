import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import PinnedChartsPanel from "../components/unified-dashboard/PinnedChartsPanel";
import { usePinnedChartStore } from "@/store/usePinnedChartStore";

// Mock GenerativeChart component to keep unit test isolated
vi.mock("@/components/ai-insights/GenerativeChart", () => ({
  default: () => <div data-testid="generative-chart" />,
}));

describe("PinnedChartsPanel", () => {
  beforeEach(() => {
    usePinnedChartStore.getState().clearPinnedCharts();
  });

  it("does not render when there are no pinned charts", () => {
    const { container } = render(<PinnedChartsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders pinned chart card with accessible Remove button aria-label", () => {
    usePinnedChartStore.getState().pinChart(
      {
        type: "bar",
        title: "Revenue by Region",
        labels: ["North", "South"],
        data: [100, 200],
      },
      "show revenue by region"
    );

    render(<PinnedChartsPanel />);

    const removeBtn = screen.getByRole("button", {
      name: "Remove from Dashboard",
    });
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn).toHaveAttribute("title", "Remove from Dashboard");

    fireEvent.click(removeBtn);
    expect(usePinnedChartStore.getState().pinnedCharts).toHaveLength(0);
  });
});
