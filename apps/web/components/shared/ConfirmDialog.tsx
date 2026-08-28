"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactElement, ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Note: tokens.css's status colors are reserved for post/account status
   * only ("never for anything else" per its own comment), so there is no
   * separate "danger" brand color to draw on here. This flag exists for
   * future copy/icon differentiation, not a different button color — the
   * confirm button always uses the one accent color, per the token hard rule.
   */
  destructive?: boolean;
  onConfirm: () => void;
  trigger?: ReactNode;
}

/**
 * Generic confirm/cancel modal (Disconnect account, Cancel post, ...).
 * Built on @radix-ui/react-dialog for focus trapping/outside-click/escape,
 * styled entirely with the @richfeed/ui token classes — no color system of
 * its own.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  trigger,
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ backgroundColor: "var(--sq-text-primary)", opacity: 0.35 }}
          className="fixed inset-0 z-40"
        />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle-2 bg-surface p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-primary">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-secondary">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-control px-3.5 py-2 text-sm font-medium text-secondary transition-colors hover:bg-sidebar-hover hover:text-primary"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className="rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
