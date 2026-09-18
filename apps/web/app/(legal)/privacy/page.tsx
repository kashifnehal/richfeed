import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../components/shared/LegalArticle";
import { PRIVACY_CONTACT_EMAIL, SITE_ORIGIN } from "../../lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — RichFeed",
  description:
    "How RichFeed collects, stores, uses, and deletes account, token, and scheduled-post data.",
};

export default function PrivacyPage() {
  return (
    <LegalArticle title="Privacy Policy">
      <p>
        This policy describes how RichFeed ({SITE_ORIGIN}), a social-media scheduling
        and publishing service operated by Kashif Nehal, handles personal data. It
        matches the product as it actually runs today — not a generic template.
        Questions or requests:{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
      </p>

      <h2>What RichFeed is</h2>
      <p>
        RichFeed lets you connect your own social accounts, compose a post, pick
        which connected accounts should receive it, and schedule a publish time.
        At that time RichFeed calls each platform&apos;s API on your behalf and
        records whether the publish succeeded. We only post to an account you
        connected, with content you supplied, at a time you set. We do not run
        ads, boost posts, scrape feeds, read DMs, or sell data.
      </p>

      <h2>What we collect</h2>
      <p>When you use RichFeed we store:</p>
      <ul>
        <li>
          <strong>Account.</strong> Email address and a hashed password, held by
          our auth provider (Supabase Auth). We do not store plaintext passwords.
          Optional profile fields you enter in Settings (display name, avatar)
          and a workspace name.
        </li>
        <li>
          <strong>Notification preferences.</strong> In-app toggles for failed
          posts and accounts that need reconnect. These preferences are stored
          only; RichFeed does not currently send email or push notifications.
        </li>
        <li>
          <strong>Connected social accounts.</strong> Platform, platform account
          id, username/handle where the platform returns one, display name,
          avatar URL, and the OAuth scopes you granted. Today that means LinkedIn
          (personal), Instagram, Facebook Pages, Threads, YouTube, and X
          (Twitter). X publishing is paused on our side for billing reasons; if
          you connected X we still hold that row until you disconnect or delete
          it.
        </li>
        <li>
          <strong>OAuth tokens.</strong> Access tokens and, where the platform
          issues one, refresh tokens. These are encrypted at rest with AES-256-GCM
          before they are written to the database. We decrypt a token only in the
          publish worker, at the moment we call the platform API for a post you
          scheduled.
        </li>
        <li>
          <strong>Scheduled posts.</strong> Captions, hashtags, media files you
          upload, per-target caption overrides, and the date/time you chose for
          each account. Media is stored in a public object bucket so the
          destination platform can fetch the file at publish time.
        </li>
        <li>
          <strong>Publish results.</strong> Per-target status (scheduled,
          published, failed, needs reconnect), the platform&apos;s post id and
          permalink when the platform returns them, and a plain-language log of
          publish attempts (including error categories, not stack traces).
        </li>
        <li>
          <strong>Short-lived connect tickets.</strong> A one-use ticket (about 60
          seconds) that bridges our app to a platform&apos;s OAuth screen. It is
          deleted when used or when it expires.
        </li>
        <li>
          <strong>Operational logs.</strong> Our hosting providers (web, API, and
          worker) may record request metadata such as IP address, user agent, and
          timestamps as part of running the service. We do not run advertising
          pixels, analytics SDKs, or cross-site trackers.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <p>We use this data only to:</p>
      <ul>
        <li>Create and authenticate your RichFeed account.</li>
        <li>
          Connect the social accounts you choose, and keep those connections
          working (including refreshing a token when the platform requires it).
        </li>
        <li>
          Publish the content you composed to the accounts you selected, at the
          times you directed, and show you whether each publish succeeded.
        </li>
        <li>
          Respond to privacy, deletion, and support requests you send to the
          contact address above.
        </li>
      </ul>
      <p>
        We do not use your captions, media, or social-account data to train AI
        models, to advertise, or to build profiles for anyone else.
      </p>

      <h2>How tokens are stored</h2>
      <p>
        OAuth access and refresh tokens are encrypted at rest with AES-256-GCM
        using a server-side key. Ciphertext is stored in our database;
        plaintext tokens are not written to logs. Tokens are decrypted in the
        worker process only to call the platform API for a post you scheduled.
      </p>

      <h2>Who we share data with</h2>
      <p>
        We share data with a connected platform <strong>only at your direction</strong>:
        when you complete that platform&apos;s OAuth consent, and when a scheduled
        post is published to an account you selected (caption, hashtags, and
        media URLs). We do not share data with ad networks. We do not sell or
        rent personal data.
      </p>
      <p>The platforms that may receive data, if you connect them, are:</p>
      <ul>
        <li>Meta — Instagram, Facebook Pages, and Threads</li>
        <li>LinkedIn — personal profile posting</li>
        <li>Google — YouTube</li>
        <li>X (Twitter) — when that connection is active</li>
      </ul>
      <p>
        We also use infrastructure processors that host the product, under their
        own terms, solely to operate RichFeed: Supabase (authentication, database,
        media storage), Vercel (the website), Railway (API and publish worker),
        and Upstash (job queue and short-lived connect tickets). They process
        data to provide those services to us, not to market to you.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential session cookies so you can stay signed in (Supabase
        Auth). We do not set advertising or third-party tracking cookies.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account, connection, and post data for as long as your RichFeed
        account exists, so you can see history and status. Disconnecting a social
        account (Accounts → Disconnect) marks it disconnected so it cannot be
        chosen for new posts; the row, encrypted tokens, and existing post
        history stay until you remove that account permanently or we delete your
        RichFeed account. Already-scheduled posts for that account may still
        publish unless you cancel them first.
      </p>
      <p>
        &quot;Remove permanently&quot; on a disconnected account deletes that
        social-account row and its stored tokens immediately, but only if no
        scheduled or published posts still reference it.
      </p>
      <p>
        A verified request to delete your entire RichFeed account is completed
        within 30 days. After that, the data listed above is removed from our
        production database and media bucket. Residual copies in encrypted
        backups are overwritten on the backup rotation cycle, typically within
        30 days of the production deletion.
      </p>

      <h2>How to disconnect an account or delete your data</h2>
      <p>
        Step-by-step instructions, including how to request full account
        deletion, are at{" "}
        <Link href="/data-deletion">Data Deletion Instructions</Link>. In short:
        disconnect or remove a social account from Accounts, and email{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>{" "}
        from the address you use to sign in to delete the RichFeed account
        itself. You can also revoke RichFeed&apos;s access in the social
        platform&apos;s own settings (for example Meta Business Integrations or
        Google Account permissions).
      </p>

      <h2>Your rights (EEA, UK, California, and similar laws)</h2>
      <p>
        If those laws apply to you, you may request access to the personal data
        we hold, correction of inaccurate data, deletion, and a portable copy of
        account and post data (we will provide it in a common
        machine-readable format). California residents: we do not sell personal
        information and we do not share it for cross-context behavioral
        advertising. To exercise any of these rights, email{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        We will verify the request against the signed-in account email before
        acting. You may also lodge a complaint with your local data-protection
        authority.
      </p>

      <h2>Children</h2>
      <p>
        RichFeed is not directed at children under 13 (or under 16 where that is
        the applicable age). We do not knowingly collect data from children.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a material way we will update the date above
        and post the new version at this URL. Continued use of RichFeed after
        that date means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy and data-deletion requests:{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        This inbox is monitored. Please use the same email address you use to
        sign in to RichFeed so we can verify the request.
      </p>
    </LegalArticle>
  );
}
