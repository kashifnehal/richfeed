import type { ReactElement, ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Generic empty-state block: icon + short message + primary action. Used
 * across Accounts/Calendar/Queue/Compose whenever a list has no rows yet.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-subtle bg-surface px-6 py-14 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-accent-muted-bg text-accent-muted-text">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
