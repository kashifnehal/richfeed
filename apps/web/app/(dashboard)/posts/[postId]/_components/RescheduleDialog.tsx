"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { RefreshCw, X } from "lucide-react";
import { useState, type ReactElement } from "react";
import { ScheduleTimePicker } from "../../../../../components/post/ScheduleTimePicker";

export interface RescheduleDialogProps {
  failedCount: number;
  onReschedule: (publishAt: string) => Promise<void>;
}

function defaultPublishAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d.toISOString();
}

/** "Fix and reschedule": picks one new time and applies it to every failed target on this post. */
export function RescheduleDialog({ failedCount, onReschedule }: RescheduleDialogProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [publishAt, setPublishAt] = useState(defaultPublishAt());
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onReschedule(publishAt);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={failedCount === 0}
          className="flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <RefreshCw size={15} />
          Fix and reschedule
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ backgroundColor: "var(--sq-text-primary)", opacity: 0.35 }}
          className="fixed inset-0 z-40"
        />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle-2 bg-surface p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-primary">
              Reschedule failed target{failedCount === 1 ? "" : "s"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-control text-secondary hover:bg-sidebar-hover hover:text-primary"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-secondary">
            Pick a new time. This will move {failedCount} failed target
            {failedCount === 1 ? "" : "s"} back to scheduled.
          </Dialog.Description>

          <div className="mt-4">
            <ScheduleTimePicker value={publishAt} onChange={setPublishAt} />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className="mt-5 w-full rounded-control bg-accent px-3.5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Rescheduling..." : "Reschedule"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
