import { FEEDBACK_EMAIL } from "../../../lib/contact";
import LegalPageShell from "../../components/LegalPageShell";

export default function TermsPageEn() {
  return (
    <LegalPageShell
      subtitle="text-based chat · invite-only"
      homeLabel="back to home"
      switchHref="/terms"
      switchLabel="Türkçe sürüm"
    >
      <h1 className="mb-2 text-neutral-200">
        <span className="text-muted">#</span> terms of use
      </h1>

      <p className="mb-8 text-xs">Last updated: August 25, 2026</p>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 1. Parties and Scope
          </h2>
          <p>
            These Terms of Use (&quot;Terms&quot;) govern the relationship
            between KOQEP (&quot;Platform&quot;) and every user who
            registers with the Platform (&quot;User&quot;,
            &quot;you&quot;). KOQEP is an invite-only, text-based,
            real-time chat service, offered free of charge.
          </p>
          <p className="mt-2">
            By registering with the Platform, you represent that you have
            read, understood, and accepted these Terms and the Privacy
            Policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 2. Definitions
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>
              <strong>Platform</strong>: the entirety of the KOQEP service
              (web interface, servers, infrastructure).
            </li>
            <li>
              <strong>User Content</strong>: any message, room name, room
              description, and similar content created by users on the
              Platform.
            </li>
            <li>
              <strong>Moderator</strong>: a user designated by the Platform
              with authority over content review and user management.
            </li>
            <li>
              <strong>Account</strong>: the registration, protected by an
              email address and password, that gives a user access to the
              Platform.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 3. Account Creation and
            User Responsibilities
          </h2>
          <p>
            3.1. You must be at least 18 years old to use the Platform. The
            statement you provide about your age at registration is
            relied upon.
          </p>
          <p className="mt-2">
            3.2. You are responsible for keeping your account information
            (in particular your password) confidential. You are
            responsible for all activity carried out through your account.
          </p>
          <p className="mt-2">
            3.3. You are obligated to ensure that the information you
            provide at registration is accurate.
          </p>
          <p className="mt-2">
            3.4. You may not transfer, sell, or share your account with
            another person.
          </p>
          <p className="mt-2">
            3.5. The Platform operates on an invite basis. The conditions
            for using an invite you receive and for issuing invites to
            others are subject to the rules within the Platform.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 4. User Content
          </h2>
          <p>
            4.1. You alone are responsible for any content you submit to
            the Platform.
          </p>
          <p className="mt-2">
            4.2. You own your content. By using the Platform, you permit
            this content to be processed (shown to other users, stored on
            servers, transmitted) for the purpose of providing the
            service. This permission ends when you delete your account or
            remove your content; the retention/deletion rules described in
            the Privacy Policy still apply.
          </p>
          <p className="mt-2">
            4.3. The Platform does not pre-screen the content you submit.
            However, it may review, remove, or take action regarding the
            relevant account upon report or at its own discretion.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 5. Prohibited Conduct
          </h2>
          <p>You must avoid the following conduct while using the Platform:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>
              Sharing content that is illegal, threatening, harassing,
              demeaning, or hateful
            </li>
            <li>Impersonating another person or providing misleading information</li>
            <li>
              Damaging the Platform&apos;s technical infrastructure,
              placing excessive load on it, accessing it without
              authorization using automated tools (bots, scrapers, etc.),
              or attempting to exploit security vulnerabilities
            </li>
            <li>Sharing or collecting other users&apos; personal data without consent</li>
            <li>Using the Platform for commercial purposes, unauthorized advertising, or spam</li>
            <li>
              Enabling or encouraging minors (under 18) to access the
              Platform
            </li>
          </ul>
          <p className="mt-2">
            This conduct may result in consequences such as removal of
            content, temporary restriction of the account (mute), or
            permanent closure of the account.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 6. Moderation and
            Appeals
          </h2>
          <p>
            6.1. The Platform may remove content, temporarily mute users,
            or close accounts based on user reports and moderators&apos;
            own assessment. These decisions are made along with a reason
            communicated to you.
          </p>
          <p className="mt-2">
            6.2. If you wish to appeal a moderation decision, you may apply
            by writing your reasoning to{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
            ; your application will be reviewed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 7. Intellectual Property
          </h2>
          <p>
            7.1. The &quot;KOQEP&quot; name, logo, and the Platform&apos;s
            own design, software, and interface belong to the Platform;
            these Terms transfer no rights over them to you.
          </p>
          <p className="mt-2">
            7.2. Your rights over User Content are set out in Article 4.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 8. Account Termination
          </h2>
          <p>
            8.1. You may permanently delete your account at any time from
            your account settings.
          </p>
          <p className="mt-2">
            8.2. If you violate these Terms, the Platform may restrict or
            close your account without prior notice.
          </p>
          <p className="mt-2">
            8.3. The effects of account deletion on data are described in
            the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 9. Changes to or
            Termination of the Service
          </h2>
          <p>
            The Platform reserves the right to change, temporarily suspend,
            or permanently terminate the service at any time. In such a
            case, reasonable efforts are made to notify users in advance,
            but this does not constitute a guarantee.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 10. Disclaimer of
            Warranty and Limitation of Liability
          </h2>
          <p>
            10.1. The Platform is provided &quot;as is&quot; and &quot;as
            available&quot;. No warranty is given that the Platform will
            operate uninterrupted, error-free, or free of security
            vulnerabilities.
          </p>
          <p className="mt-2">
            10.2. The Platform undertakes no obligation to provide the
            service; it may change, restrict, or terminate the service at
            any time (see Article 9). By using the Platform, you accept
            the service as it is and acknowledge that the Platform makes
            no commitment guaranteeing an uninterrupted, error-free, or
            particular outcome. The Platform&apos;s liability for damages
            arising from use of the service is limited to the fullest
            extent permitted by law, except in cases of intent and gross
            negligence.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 11. Changes
          </h2>
          <p>
            When we make a significant change to these Terms, we will
            announce the change through the Platform. Continuing to use
            the Platform after a change means you accept the updated
            Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 12. Severability
          </h2>
          <p>
            If any provision of these Terms is held invalid or
            unenforceable, the validity of the remaining provisions is not
            affected.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 13. One Policy, Two
            Languages
          </h2>
          <p>
            These Terms of Use and the Privacy Policy are the Turkish and
            English counterparts of one and the same policy text — they
            are identical in content, differing only in language. The
            intent is not to create different rights or obligations in
            different languages, but to make the same text accessible in
            both. If you notice a difference in meaning arising from
            translation, you may let us know at{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
            ; the text will then be reviewed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 14. Contact
          </h2>
          <p>
            For your questions, appeals, and requests, you can reach us at{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
