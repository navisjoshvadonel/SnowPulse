import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import ApiKeysModal from "../components/modals/ApiKeysModal";

describe("ApiKeysModal", () => {
  it("renders modal when open and has accessible copy button", () => {
    const handleClose = vi.fn();
    render(<ApiKeysModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText("API Keys & Integrations")).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy api key/i });
    expect(copyBtn).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close modal/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    const { container } = render(<ApiKeysModal isOpen={false} onClose={handleClose} />);

    expect(container.firstChild).toBeNull();
  });
});
