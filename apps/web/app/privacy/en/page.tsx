import Link from "next/link";

import { FEEDBACK_EMAIL } from "../../../lib/contact";

export default function PrivacyPageEn() {
  return (
    <main lang="en" className="animate-fade-in mx-auto max-w-2xl p-4 text-neutral-400">
      <h1 className="mb-2 text-neutral-400">
        <span className="text-muted">#</span> privacy policy
      </h1>

      <p className="mb-8 text-xs">Last updated: August 25, 2026</p>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 1. Data Controller
          </h2>
          <p>The data controller for this Platform is KOQEP.</p>
          <p className="mt-2">
            Contact:{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 2. What Data We Collect
          </h2>

          <p className="mt-2 font-semibold text-neutral-300">
            2.1 During registration
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Email address</li>
            <li>Username</li>
            <li>
              Password (stored in irreversibly hashed form, never kept as
              plain text)
            </li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-300">
            2.2 During use
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Messages you send</li>
            <li>Rooms you create and their descriptions</li>
            <li>
              If you set up optional two-factor authentication (2FA), its
              secret key (stored encrypted)
            </li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-300">
            2.3 Connection/traffic information
          </p>
          <p className="mt-1">
            Under the legal obligation Turkish Law No. 5651 imposes on
            hosting providers, the following information about connections
            made to the Platform is retained for{" "}
            <strong>18 months</strong>:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Your IP address</li>
            <li>Connection/request time</li>
            <li>Type of service accessed</li>
            <li>Amount of data transferred</li>
          </ul>
          <p className="mt-2">
            From the moment they are recorded, these logs are protected with
            an integrity check (cryptographic hash) and are automatically
            deleted after 18 months. These logs are kept solely to fulfill
            our legal obligation; they are not used for marketing,
            profiling, or shared with third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 3. Who We Share Your Data
            With
          </h2>
          <p>
            Data may be shared with the technical infrastructure providers
            required for the Platform to operate (hosting, email delivery,
            error tracking, and similar), only to the extent necessary to
            provide the service and with your explicit consent. These
            providers may be located domestically or abroad. This consent is
            obtained through the checkbox by which you accept this policy
            and the Terms of Use during registration — once registration is
            complete, consent is considered given, no separate action is
            required.
          </p>
          <p className="mt-2">
            Your messages are visible to other users in the rooms you join.
            Beyond that, we do not share, sell, or use any of your content
            for advertising purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 4. Your Rights
          </h2>

          <p className="mt-2 font-semibold text-neutral-300">
            4.1 Downloading your data
          </p>
          <p className="mt-1">
            From your account settings, you can download your own profile,
            messages, invite records, and reputation history in JSON
            format.
          </p>

          <p className="mt-4 font-semibold text-neutral-300">
            4.2 Deleting your account
          </p>
          <p className="mt-1">When you delete your account:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Your account information is permanently deleted</li>
            <li>
              The author link on your messages is removed (messages remain
              in the room so as not to disrupt the conversation&apos;s
              context, but can no longer be traced back to you)
            </li>
            <li>
              <strong>Optionally</strong>, you may also choose to have your
              message content removed (this option is checked by default)
            </li>
            <li>
              Regardless of which option you choose, our system
              automatically removes any personal information it detects in
              your messages, such as an email address or phone number
            </li>
          </ul>
          <p className="mt-2">
            This approach is based on a &quot;reasonable effort&quot;
            standard: no automated system can detect every kind of personal
            disclosure (for example, an indirect, contextual clue) with
            100% reliability. If, after deleting your account, you notice
            your personal information remaining in an old message, you can
            contact us at{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            to request its removal — such requests are handled manually,
            within a reasonable time.
          </p>

          <p className="mt-4 font-semibold text-neutral-300">
            4.3 Your other rights
          </p>
          <p className="mt-1">
            Under Article 11 of the KVKK, you have the right to learn
            whether your data is being processed, to request information
            about it if so, to learn the purpose of processing, to know the
            third parties to whom it is transferred domestically or abroad,
            and to request correction if it has been processed
            incompletely or incorrectly. You can reach us for these
            requests at{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 5. Cookies and Local
            Storage
          </h2>
          <p>
            The Platform does not use cookies for tracking. To keep you
            signed in, your browser&apos;s local storage and a secure,
            HTTP-only session cookie are used — this is not for third-party
            tracking, it only keeps your session active.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 6. Age Limit
          </h2>
          <p>You must be at least 18 years old to use the Platform.</p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 7. Changes to This Policy
          </h2>
          <p>
            When we make a significant change to this policy, we will
            announce the change through the Platform.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 8. Bilingual Text
          </h2>
          <p>
            This policy is designed as a consistent, common, general text
            across its Turkish and English versions — drafted without
            excessive detail specific to any one jurisdiction, so that it
            can be adapted to different contexts of use.
          </p>
          <p className="mt-2 text-xs">
            Which version is binding in the event of a conflict between the
            versions has not yet been settled — this point will be
            clarified once the common text is submitted for legal
            approval.
          </p>
        </section>
      </div>

      <p className="mt-8 flex gap-4 text-xs">
        <Link href="/" className="text-muted hover:text-neutral-400">
          back to home
        </Link>
        <Link href="/privacy" className="text-muted hover:text-neutral-400">
          Türkçe sürüm
        </Link>
      </p>
    </main>
  );
}
