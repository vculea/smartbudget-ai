import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("apelează onConfirm și onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Ștergi?"
        description="Acțiune ireversibilă"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ștergi?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Anulează" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Șterge" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("nu randează nimic când este închis", () => {
    render(
      <ConfirmDialog
        open={false}
        title="X"
        description="Y"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
