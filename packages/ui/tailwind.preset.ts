import type { Config } from "tailwindcss";

/**
 * The Social Queue — Tailwind preset.
 * Maps every design token in `tokens.css` to exactly one Tailwind color / radius
 * name. Components and apps use these classes; no raw hex anywhere else.
 */
const preset = {
  content: [],
  theme: {
    extend: {
      colors: {
        /* base surfaces */
        app: "var(--sq-bg-app)",
        sidebar: {
          DEFAULT: "var(--sq-bg-sidebar)",
          hover: "var(--sq-bg-sidebar-hover)",
        },
        surface: "var(--sq-bg-surface)",
        subtle: "var(--sq-border-subtle)",
        "subtle-2": "var(--sq-border-subtle-2)",

        /* text */
        primary: "var(--sq-text-primary)",
        secondary: "var(--sq-text-secondary)",
        "nav-inactive": "var(--sq-text-nav-inactive)",
        "on-accent": "var(--sq-text-on-accent)",

        /* accent */
        accent: {
          DEFAULT: "var(--sq-accent)",
          hover: "var(--sq-accent-hover)",
          "muted-bg": "var(--sq-accent-muted-bg)",
          "muted-text": "var(--sq-accent-muted-text)",
        },

        /* status — post/account status only */
        status: {
          "scheduled-text": "var(--sq-status-scheduled-text)",
          "scheduled-bg": "var(--sq-status-scheduled-bg)",
          "published-text": "var(--sq-status-published-text)",
          "published-bg": "var(--sq-status-published-bg)",
          "failed-text": "var(--sq-status-failed-text)",
          "failed-bg": "var(--sq-status-failed-bg)",
          "needs-reconnect-text": "var(--sq-status-needs-reconnect-text)",
          "needs-reconnect-bg": "var(--sq-status-needs-reconnect-bg)",
          "queued-text": "var(--sq-status-queued-text)",
          "queued-bg": "var(--sq-status-queued-bg)",
        },

        /* platform brand colors — platform badges/icons only */
        platform: {
          instagram: "var(--sq-platform-instagram)",
          facebook: "var(--sq-platform-facebook)",
          x: "var(--sq-platform-x)",
          linkedin: "var(--sq-platform-linkedin)",
          youtube: "var(--sq-platform-youtube)",
          tiktok: "var(--sq-platform-tiktok)",
        },
      },
      borderRadius: {
        card: "var(--sq-radius-card)",
        control: "var(--sq-radius-control)",
        pill: "var(--sq-radius-pill)",
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
