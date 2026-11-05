import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PdfExportModal from "../components/modals/PdfExportModal";

describe("PdfExportModal", () => {
  const mockClose = vi.fn();

  it("renders modal content and has accessible close button", () => {
    render(
      <PdfExportModal
        isOpen={true}
        onClose={mockClose}
        datasetName="Test Dataset"
        kpis={{ total_records: 100, quality_score: 99.0, mean_value: 50.0 }}
        datasetSchema={{ columns: [] }}
        aiInsights={{ headline: "Test Headline", recommendations: [] }}
      />
    );

    expect(screen.getByText("Executive PDF Report Generator")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close modal" });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
