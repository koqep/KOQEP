import Link from "next/link";

export default function TermsPageEn() {
  return (
    <main lang="en" className="animate-fade-in mx-auto max-w-2xl p-4 text-neutral-400">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-muted">#</span> terms of use
      </h1>

      <p className="mb-6 border border-neutral-800 bg-neutral-900/50 p-3 text-neutral-200">
        DRAFT — not binding, the real legal text is not live yet.
      </p>

      <p className="mb-6 text-xs">
        Which language version is binding in case of a conflict between the
        Turkish and English text has not been legally reviewed yet.
      </p>

      <div className="flex flex-col gap-4">
        <p>
          This page stands in for the real terms of use, which will explain
          the conditions for using KOQEP (including accounts, the invite
          system, moderation, and content responsibility). The text will be
          written here once the legal review under Turkish law (5651/KVKK) is
          complete.
        </p>
        <p>
          Minimum age: [AGE LIMIT — pending legal review] (per KVKK&apos;s
          provisions on children&apos;s data).
        </p>
      </div>

      <p className="mt-8 flex gap-4 text-xs">
        <Link href="/" className="text-muted hover:text-neutral-400">
          back to home
        </Link>
        <Link href="/terms" className="text-muted hover:text-neutral-400">
          Türkçe sürüm
        </Link>
      </p>
    </main>
  );
}
