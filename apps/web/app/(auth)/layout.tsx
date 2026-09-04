import type { ReactElement, ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-on-accent">
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h11" />
            </svg>
          </span>
          <span className="text-base font-extrabold tracking-tight text-primary">RichFeed</span>
        </div>
        <div className="rounded-card border border-subtle-2 bg-surface p-7 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
