import Link from "next/link";
import type { ReactElement } from "react";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/data-deletion", label: "Data Deletion" },
] as const;

export function SiteFooter(): ReactElement {
  return (
    <footer className="border-t border-subtle px-4 py-4">
      <nav
        aria-label="Legal"
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs font-medium text-secondary transition-colors hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
