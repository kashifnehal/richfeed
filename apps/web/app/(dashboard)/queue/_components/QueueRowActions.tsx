"use client";

import { Copy, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { ConfirmDialog } from "../../../../components/shared/ConfirmDialog";
import { DuplicateDialog } from "../../../../components/post/DuplicateDialog";
import type { QueueRowData } from "../../../../lib/queue-rows";

export interface QueueRowActionsProps {
  row: QueueRowData;
  accounts: SocialAccountDto[];
  onCancel: (targetId: string) => Promise<void>;
  onDuplicate: (postId: string, accountId: string, publishAt: string) => Promise<void>;
}

export function QueueRowActions({ row, accounts, onCancel, onDuplicate }: QueueRowActionsProps): ReactElement {
  const [cancelOpen, setCancelOpen] = useState(false);
  const canCancel = row.status !== "published";

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/posts/${row.postId}`}
        aria-label="Edit post"
        className="flex h-8 w-8 items-center justify-center rounded-control text-secondary transition-colors hover:bg-sidebar-hover hover:text-primary"
      >
        <Pencil size={15} />
      </Link>

      <DuplicateDialog
        accounts={accounts}
        onDuplicate={(accountId, publishAt) => onDuplicate(row.postId, accountId, publishAt)}
        trigger={
          <button
            type="button"
            aria-label="Duplicate to another account"
            className="flex h-8 w-8 items-center justify-center rounded-control text-secondary transition-colors hover:bg-sidebar-hover hover:text-primary"
          >
            <Copy size={15} />
          </button>
        }
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this target?"
        description="It will be removed from the queue."
        confirmLabel="Cancel target"
        onConfirm={() => void onCancel(row.targetId)}
        trigger={
          <button
            type="button"
            disabled={!canCancel}
            aria-label="Cancel"
            className="flex h-8 w-8 items-center justify-center rounded-control text-secondary transition-colors hover:bg-sidebar-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={15} />
          </button>
        }
      />
    </div>
  );
}
