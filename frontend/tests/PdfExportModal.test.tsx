import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PdfExportModal from "../components/modals/PdfExportModal";

describe("PdfExportModal Accessibility", () => {
  it("renders buttons with accessible ARIA labels", () => {
    const handleClose = vi.fn();
    render(
      <PdfExportModal
        isOpen={true}
        onClose={handleClose}
        datasetName="Test Dataset"
        kpis={{ total_records: 100, quality_score: 99.5, mean_value: 50 }}
        datasetSchema={{ columns: [] }}
        aiInsights={{ headline: "Test summary", recommendations: [] }}
      />
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    expect(closeButton).toBeDefined();

    const printButton = screen.getByRole("button", { name: /print or download pdf report/i });
    expect(printButton).toBeDefined();
  });
});
