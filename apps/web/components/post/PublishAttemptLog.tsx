import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";
import type { PublishAttemptDto } from "@richfeed/shared";

export interface PublishAttemptLogProps {
  attempts: PublishAttemptDto[];
}

/** Collapsible list of publish attempts, in plain language — never a raw stack trace. */
export function PublishAttemptLog({ attempts }: PublishAttemptLogProps): ReactElement | null {
  if (attempts.length === 0) return null;

  return (
    <details className="rounded-control border border-subtle-2 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
        Publish attempts ({attempts.length})
        <ChevronDown size={16} className="text-secondary" />
      </summary>
      <div className="flex flex-col divide-y divide-subtle-2 border-t border-subtle-2">
        {attempts.map((attempt) => (
          <div key={attempt.id} className="flex flex-col gap-0.5 px-3.5 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">Attempt {attempt.attemptNumber}</span>
              <span className="text-xs text-secondary">
                {new Date(attempt.attemptedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-secondary">
              {attempt.errorMessage ??
                (attempt.httpStatus && attempt.httpStatus < 400
                  ? "Published successfully."
                  : "The attempt failed with no additional details.")}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
