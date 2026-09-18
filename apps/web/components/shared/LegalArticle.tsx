import type { ReactElement, ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "../../lib/legal";

export function LegalArticle({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-primary">{title}</h1>
      <p className="mt-2 text-sm text-secondary">Last updated: {LEGAL_LAST_UPDATED}</p>
      <div className="legal-body mt-8">{children}</div>
    </article>
  );
}
