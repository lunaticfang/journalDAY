// app/instructions/page.tsx

export default function InstructionsPage() {
  // TODO: replace this with your real Supabase public URL
  const pdfUrl =
    "https://aiotuwaefdvlaisjwxun.supabase.co/storage/v1/object/public/instructions-pdfs/UpDAYtes_Author%20or%20Contributors%20Guidelines.pdf";

  return (
    <main className="mx-auto flex max-w-6xl gap-8 px-6 py-10 text-gray-900">
      {/* LEFT: sidebar like JAPI’s “On this page” */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Instructions
          </p>
          <nav className="space-y-1">
            <a
              href="#overview"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Overview
            </a>
            <a
              href="#scope"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Scope &amp; article types
            </a>
            <a
              href="#prep"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Manuscript preparation
            </a>
            <a
              href="#ethics"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Ethics &amp; consent
            </a>
            <a
              href="#review"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Review process
            </a>
            <a
              href="#pdf"
              className="block rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Full PDF guidelines
            </a>
          </nav>
        </div>
      </aside>

      {/* RIGHT: main content + embedded PDF */}
      <div className="flex-1">
        {/* Header */}
        <header className="mb-6 border-b border-gray-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Authors
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Instructions for Authors
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            Please carefully read these instructions before submitting a
            manuscript to JournalDAY. The full official guidelines are available
            as a PDF at the end of this page.
          </p>
        </header>

        {/* Short “summary sections” that mirror JAPI-style content, but your PDF is source of truth */}

        <section id="overview" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            1. Overview
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">
            JournalDAY publishes peer-reviewed material in medicine and allied
            disciplines. Submissions should be original, previously unpublished
            work that meaningfully adds to clinical practice, research, or
            education.
          </p>
        </section>

        <section id="scope" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            2. Scope &amp; Article Types
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            The journal generally considers the following categories:
          </p>
          <ul className="mb-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Original research articles</li>
            <li>Review articles</li>
            <li>Case reports and case series</li>
            <li>Brief communications</li>
            <li>Letters to the editor</li>
            <li>Editorials and invited commentary</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            The detailed word limits, reference limits, and formatting for each
            category are provided in the PDF guidelines below.
          </p>
        </section>

        <section id="prep" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            3. Manuscript Preparation
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Authors are expected to prepare their manuscripts in clear,
            concise English, following a standard structure (for example:
            Title page, Abstract, Introduction, Methods, Results, Discussion,
            Conclusion, References).
          </p>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Specific instructions regarding font, spacing, reference style,
            tables, figures, and supplementary files are provided in the full
            guideline document. Please ensure that all files are labelled in a
            consistent and unambiguous manner before submission.
          </p>
        </section>

        <section id="ethics" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            4. Ethics, Consent &amp; Conflict of Interest
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            All work submitted to JournalDAY must comply with accepted
            international ethical standards. Studies involving human
            participants or animals should have prior approval from the
            appropriate ethics committee.
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Obtain written informed consent where required.</li>
            <li>
              Remove or anonymize identifying information for patients and
              participants.
            </li>
            <li>
              Disclose any potential conflicts of interest and sources of
              funding.
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            The PDF guidelines provide example formats for ethics statements,
            consent declarations, and conflict-of-interest disclosures.
          </p>
        </section>

        <section id="review" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            5. Submission &amp; Review Process
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Manuscripts are submitted through the JournalDAY submission system.
            The editorial office performs an initial check, followed by peer
            review for suitable submissions.
          </p>
          <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Online submission and basic compliance check.</li>
            <li>Assignment to handling editor, if in scope.</li>
            <li>Anonymous review by one or more expert reviewers.</li>
            <li>Decision: accept, revise, or reject.</li>
          </ol>
          <p className="text-xs text-gray-500">
            Timelines, revision policies, and specific reviewer expectations are
            outlined in more detail in the PDF document.
          </p>
        </section>

        {/* PDF EMBED – JAPI-style viewer section */}
        <section id="pdf" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Full Author &amp; Contributor Guidelines (PDF)
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            The complete, authoritative set of instructions is provided in the
            PDF document below. Authors should treat that document as the final
            reference for formatting, article categories, and procedural
            details.
          </p>

          <div className="h-[80vh] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
            <iframe
              src={pdfUrl}
              title="Author Guidelines PDF"
              className="h-full w-full"
              style={{ border: "none" }}
            />
          </div>

          <p className="mt-3 text-xs text-gray-500">
            If the PDF does not display correctly in your browser,{" "}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 underline underline-offset-2"
            >
              click here to open it in a new tab
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
