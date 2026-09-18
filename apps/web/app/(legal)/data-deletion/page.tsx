import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../../components/shared/LegalArticle";
import { PRIVACY_CONTACT_EMAIL, SITE_ORIGIN } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Data Deletion Instructions — RichFeed",
  description:
    "How to disconnect a social account from RichFeed and how to request deletion of your RichFeed data.",
};

export default function DataDeletionPage() {
  return (
    <LegalArticle title="Data Deletion Instructions">
      <p>
        This page is the public instructions URL for deleting data RichFeed holds
        about you, including data received from Meta (Instagram, Facebook Pages,
        Threads) and from other connected platforms. It is the process we
        actually operate today. The{" "}
        <Link href="/privacy">Privacy Policy</Link> explains what we collect
        and why.
      </p>

      <h2>1. Disconnect a social account (stop new publishes)</h2>
      <ul>
        <li>
          Sign in at <a href={SITE_ORIGIN}>{SITE_ORIGIN}</a>.
        </li>
        <li>Open <strong>Accounts</strong> in the sidebar.</li>
        <li>
          On the connected account, open the actions menu and choose{" "}
          <strong>Disconnect</strong>. Confirm.
        </li>
      </ul>
      <p>
        Disconnect marks the account disconnected. It will not appear as a
        target for new posts. Existing post history stays in RichFeed. Encrypted
        access and refresh tokens remain stored until you complete step 2 or
        step 3. If you still have posts scheduled for that account, cancel them
        from the Queue or the post page — disconnect does not cancel
        already-queued publishes by itself.
      </p>
      <p>
        You should also revoke RichFeed in the platform&apos;s own settings so
        the platform stops treating us as an authorized app (Meta: Settings →
        Business integrations / Instagram authorized apps; Google: Your Google
        Account → Third-party access; LinkedIn and X: their equivalent
        authorized-apps screens).
      </p>

      <h2>2. Remove the social account from RichFeed (deletes stored tokens)</h2>
      <ul>
        <li>
          After the account shows as disconnected, open the actions menu again
          and choose <strong>Remove permanently</strong>.
        </li>
        <li>
          This deletes that social-account row from our database, including the
          encrypted tokens.
        </li>
        <li>
          Removal is blocked while any scheduled or published posts still
          reference the account. Cancel or wait until those posts no longer
          attach to it, then retry.
        </li>
      </ul>

      <h2>3. Delete your entire RichFeed account</h2>
      <p>
        There is no in-app button that wipes the whole account yet. Email{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}?subject=RichFeed%20data%20deletion%20request`}>
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        from the <strong>same address you use to sign in</strong>, with the
        subject line <strong>RichFeed data deletion request</strong>.
      </p>
      <p>In that email, say whether you want us to delete:</p>
      <ul>
        <li>Only a named connected social account, or</li>
        <li>
          Your entire RichFeed account: auth user (email), workspace,
          notification preferences, scheduled posts, media files, publish
          history, and remaining social-account tokens.
        </li>
      </ul>
      <p>
        We verify the request against the account email, then delete the data
        from our production database and media bucket within <strong>30 days</strong>.
        Residual copies in encrypted backups are overwritten on the backup
        rotation cycle, typically within 30 days after that. We will reply to
        the same address when the production deletion is done.
      </p>
      <p>
        Posts that already went live on Instagram, Facebook, Threads, LinkedIn,
        YouTube, or X are on those platforms. Deleting RichFeed data does not
        take those posts down; remove them in the platform itself if you want
        them gone.
      </p>

      <h2>Meta (Facebook / Instagram / Threads) users</h2>
      <p>
        If you connected RichFeed through Meta Login and want Meta-held
        authorization removed as well as our copy of the tokens, complete steps
        1–3 above and revoke the app under your Meta / Instagram settings. This
        URL — {SITE_ORIGIN}/data-deletion — is the instructions address we
        provide for Meta App Review and user data-deletion requests.
      </p>

      <h2>Contact</h2>
      <p>
        Deletion and privacy requests:{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        This inbox is monitored.
      </p>
    </LegalArticle>
  );
}
