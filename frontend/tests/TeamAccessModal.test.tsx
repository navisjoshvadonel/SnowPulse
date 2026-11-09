import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import TeamAccessModal from "../components/modals/TeamAccessModal";

describe("TeamAccessModal", () => {
  it("renders modal when open and has accessible close button and member list", () => {
    const handleClose = vi.fn();
    render(<TeamAccessModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText("Team & Organization Access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close modal/i })).toBeInTheDocument();
    expect(screen.getByText("Executive Admin")).toBeInTheDocument();
    expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();

    const removeSarahBtn = screen.getByRole("button", { name: "Remove Sarah Connor" });
    expect(removeSarahBtn).toBeInTheDocument();

    const removeAlexBtn = screen.getByRole("button", { name: "Remove Alex Rivera" });
    expect(removeAlexBtn).toBeInTheDocument();
  });

  it("removes a member when the accessible remove button is clicked", () => {
    const handleClose = vi.fn();
    render(<TeamAccessModal isOpen={true} onClose={handleClose} />);

    const removeSarahBtn = screen.getByRole("button", { name: "Remove Sarah Connor" });
    fireEvent.click(removeSarahBtn);

    expect(screen.queryByText("Sarah Connor")).not.toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    const { container } = render(<TeamAccessModal isOpen={false} onClose={handleClose} />);

    expect(container.firstChild).toBeNull();
  });
});
