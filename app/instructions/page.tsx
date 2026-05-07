import { buildPageMetadata } from "../../lib/seo";

export const metadata = buildPageMetadata({
  title: "Author Guidelines",
  description:
    "Read the main author instructions, manuscript preparation guidance, and publication policies for UpDAYtes.",
  path: "/instructions",
});

const FALLBACK_GUIDELINES_PDF =
  "https://aiotuwaefdvlaisjwxun.supabase.co/storage/v1/object/public/instructions-pdfs/UpDAYtes_Author%20or%20Contributors%20Guidelines.pdf";

function getGuidelinesPdfUrl() {
  return (
    process.env.NEXT_PUBLIC_GUIDELINES_PDF_URL ||
    process.env.NEXT_PUBLIC_INSTRUCTIONS_PDF_URL ||
    FALLBACK_GUIDELINES_PDF
  );
}

export default function InstructionsPage() {
  const pdfUrl = getGuidelinesPdfUrl();

  return (
    <main className="mx-auto flex max-w-6xl gap-8 px-6 py-10 text-gray-900">
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
              Scope and article types
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
              Ethics and consent
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

      <div className="flex-1">
        <header className="mb-6 border-b border-gray-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Authors
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Instructions for Authors
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            Please read these instructions before submitting a manuscript to
            UpDAYtes. The full official guideline PDF is available at the end
            of this page.
          </p>
        </header>

        <section id="overview" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">1. Overview</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            UpDAYtes publishes peer-reviewed material in medicine and allied
            disciplines. Submissions should be original, previously unpublished
            work that contributes to clinical practice, research, or education.
          </p>
        </section>

        <section id="scope" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            2. Scope and article types
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
            Detailed limits and formatting requirements are provided in the PDF
            guidelines below.
          </p>
        </section>

        <section id="prep" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            3. Manuscript preparation
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Prepare manuscripts in clear English using a standard structure:
            title page, abstract, introduction, methods, results, discussion,
            conclusion, and references.
          </p>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Use consistent file naming and ensure uploaded files are complete
            and final before submission.
          </p>
        </section>

        <section id="ethics" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            4. Ethics, consent, and conflict of interest
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            All submissions must follow accepted ethical standards. Studies
            involving human participants or animals should include prior ethics
            committee approval where required.
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Obtain written informed consent where applicable.</li>
            <li>Remove identifying patient or participant details.</li>
            <li>Disclose conflicts of interest and funding sources.</li>
          </ul>
        </section>

        <section id="review" className="mb-8 scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            5. Submission and review process
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-gray-700">
            Manuscripts are submitted through the UpDAYtes portal. Suitable
            submissions are sent for peer review after editorial screening.
          </p>
          <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Online submission and compliance check.</li>
            <li>Editorial handling assignment.</li>
            <li>Anonymous peer review.</li>
            <li>Decision: accept, revise, or reject.</li>
          </ol>
        </section>

        <section id="pdf" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Full author and contributor guidelines (PDF)
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            This PDF is the authoritative reference for formatting, policy, and
            submission requirements.
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
            If the PDF does not render in your browser,{" "}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 underline underline-offset-2"
            >
              open the guidelines in a new tab
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
