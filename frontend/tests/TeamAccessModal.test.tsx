import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import TeamAccessModal from "../components/modals/TeamAccessModal";

describe("TeamAccessModal", () => {
  it("renders accessible controls for role selection and member deletion", () => {
    const handleClose = vi.fn();
    render(<TeamAccessModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText("Team & Organization Access")).toBeInTheDocument();

    const roleSelect = screen.getByRole("combobox", { name: /select member role/i });
    expect(roleSelect).toBeInTheDocument();

    const removeSarahBtn = screen.getByRole("button", { name: /remove member sarah connor/i });
    expect(removeSarahBtn).toBeInTheDocument();

    fireEvent.click(removeSarahBtn);
    expect(screen.queryByText("Sarah Connor")).not.toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    const { container } = render(<TeamAccessModal isOpen={false} onClose={handleClose} />);

    expect(container.firstChild).toBeNull();
  });
});
