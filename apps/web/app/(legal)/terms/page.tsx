import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle } from "../../../components/shared/LegalArticle";
import { PRIVACY_CONTACT_EMAIL, SITE_ORIGIN } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — RichFeed",
  description:
    "Terms for using RichFeed, including acceptable use, posting at your direction, and platform outages.",
};

export default function TermsPage() {
  return (
    <LegalArticle title="Terms of Service">
      <p>
        These Terms govern your use of RichFeed ({SITE_ORIGIN}), a social-media
        scheduling and publishing service operated by Kashif Nehal. By creating
        an account or using the service you agree to them. If you do not agree,
        do not use RichFeed. Our{" "}
        <Link href="/privacy">Privacy Policy</Link> explains how we handle
        data. How to delete data is at{" "}
        <Link href="/data-deletion">Data Deletion Instructions</Link>.
      </p>

      <h2>The service</h2>
      <p>
        RichFeed lets you connect social accounts you control, compose posts,
        choose which of those accounts should receive a post, and schedule a
        publish time. RichFeed then calls each platform&apos;s API{" "}
        <strong>only at your explicit direction</strong> — the content you
        supplied, the accounts you selected, the time you set. We do not post
        on our own initiative, scrape your feed, manage ads, or send messages
        other than the post you scheduled.
      </p>
      <p>
        Platforms available to connect today are LinkedIn (personal profile),
        Instagram, Facebook Pages, Threads, YouTube, and X (Twitter). Some
        connections may be limited by that platform (for example an app in
        development mode, a paused integration, or an unverified OAuth app).
        Media types also differ by platform: RichFeed will refuse to schedule a
        combination the destination does not support (for example video to
        LinkedIn, or a text-only Instagram post).
      </p>

      <h2>Your account</h2>
      <p>
        You must provide an accurate email and keep your password confidential.
        You are responsible for activity on your account. You may disconnect a
        social account or request deletion of your RichFeed account as described
        in the Data Deletion Instructions. We may suspend or close an account
        that violates these Terms or that a connected platform requires us to
        disable.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use RichFeed to:</p>
      <ul>
        <li>
          Post content you do not have the right to post, or that is illegal,
          hateful, or that violates a connected platform&apos;s terms.
        </li>
        <li>
          Spam, scrape, or automate activity beyond scheduling posts you
          actually composed for accounts you are authorized to manage.
        </li>
        <li>
          Probe, disrupt, or reverse-engineer the service, or attempt to access
          another user&apos;s data.
        </li>
        <li>Misrepresent the source of a post or impersonate someone else.</li>
      </ul>
      <p>
        Each connected platform&apos;s own terms still apply. If Instagram,
        Facebook, Threads, LinkedIn, YouTube, or X takes action on a post or an
        account, that is between you and the platform.
      </p>

      <h2>Publishing, timing, and platform limits</h2>
      <p>
        A scheduled time is a target, not a guarantee of the exact second. Actual
        publish time can move because of queue processing, platform review of
        uploaded media, or an outage. Connected platforms also impose their own
        rate limits, quotas, content rules, and downtime. RichFeed is not liable
        for a late, skipped, or failed publish caused by a connected
        platform&apos;s rate limits, outages, policy enforcement, or API
        changes.
      </p>
      <p>
        If a connected platform revokes, restricts, or sunsets RichFeed&apos;s
        API access, publishing to that platform may become unavailable through
        no fault of yours. We will surface a failure or a needs-reconnect state
        rather than a silent success. We are not obligated to provide a
        substitute platform.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of captions, hashtags, and media you upload. You
        grant RichFeed a limited license to store that content and to transmit
        it to the platforms you selected, solely to provide the scheduling and
        publishing service. We do not claim a broader license and we do not use
        your content for advertising.
      </p>

      <h2>Fees</h2>
      <p>
        RichFeed does not currently charge for the service. If paid plans are
        introduced, additional pricing terms will be presented before you are
        billed. Connected platforms may charge their own fees (for example
        X&apos;s API usage); those are not RichFeed charges.
      </p>

      <h2>Disclaimer and limitation of liability</h2>
      <p>
        RichFeed is provided &quot;as is.&quot; We do not warrant uninterrupted
        or error-free operation, or that every scheduled post will appear
        exactly on time on every platform. To the maximum extent permitted by
        law, Kashif Nehal and RichFeed are not liable for indirect, incidental,
        special, or consequential damages, or for lost posts, lost profits, or
        platform penalties arising from your use of the service or from a
        connected platform&apos;s conduct. Our total liability for a claim
        relating to the service is limited to the amount you paid us for
        RichFeed in the three months before the claim (currently zero, while the
        service is free).
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using RichFeed at any time and request deletion under the
        Data Deletion Instructions. We may suspend or terminate access if you
        violate these Terms, if a platform requires it, or if we discontinue the
        service. Provisions that by their nature should survive (including
        limitation of liability) remain in effect.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. The date at the top of this page will change
        when we do. Continued use after that date constitutes acceptance.
        Material changes that affect a paid plan, if any exist then, will be
        communicated to the email on your account.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
      </p>
    </LegalArticle>
  );
}
