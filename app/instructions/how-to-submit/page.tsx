import Link from "next/link";
import { buildPageMetadata } from "../../../lib/seo";

export const metadata = buildPageMetadata({
  title: "How to Submit Your Manuscript",
  description:
    "Follow the step-by-step UpDAYtes manuscript submission process, including which PDF and Word files to upload.",
  path: "/instructions/how-to-submit",
});

const STEPS = [
  {
    number: "01",
    title: "Sign in to the submission portal",
    body:
      "Use your author account before starting the form. The submission will be linked to that account so you can track status updates later from the dashboard.",
  },
  {
    number: "02",
    title: "Prepare both manuscript files",
    body:
      "Keep one clean PDF for reference and review, and one editable Word document for copyediting and production. Make sure both files represent the same version of the manuscript.",
  },
  {
    number: "03",
    title: "Enter manuscript and author details",
    body:
      "Add the manuscript title, abstract, lead author name, and any co-authors with matching email addresses. Complete details here make later editorial communication much smoother.",
  },
  {
    number: "04",
    title: "Upload the correct file in each field",
    body:
      "Attach the PDF in the PDF upload block and the Word document in the editable manuscript block. Do not swap them, because each file is used differently during review and production.",
  },
  {
    number: "05",
    title: "Submit and keep your receipt",
    body:
      "After submission, UpDAYtes records the manuscript and sends a confirmation email with the submission ID, receipt code, and timestamp. Keep that email for your records.",
  },
];

const FILE_GUIDE = [
  {
    label: "PDF Upload",
    type: "Attach a PDF version",
    details:
      "Use this for the review-ready manuscript exactly as you want it read. This should be the final PDF snapshot of the same manuscript version.",
    accept: "Accepted: PDF only",
  },
  {
    label: "Word Upload",
    type: "Attach the editable manuscript",
    details:
      "Upload the editable .doc or .docx version here. This file is used for editorial revision, formatting, and production work after review.",
    accept: "Accepted: DOC or DOCX",
  },
];

export default function SubmissionGuidePage() {
  return (
    <main className="submission-guide">
      <section className="submission-guide__hero">
        <p className="submission-guide__eyebrow">Author Guidelines</p>
        <div className="submission-guide__location">
          <span>You are here</span>
          <strong>Author Guidelines / How to Submit Your Manuscript</strong>
        </div>
        <h1>How to Submit Your Manuscript</h1>
        <p className="submission-guide__lede">
          This page walks you through the UpDAYtes submission flow in a practical
          way, so you know what to prepare, what to upload, and what proof you
          receive after submission.
        </p>

        <div className="submission-guide__heroActions">
          <Link href="/author/submit" className="submission-guide__primary">
            Open Submission Portal
          </Link>
          <Link href="/instructions" className="submission-guide__secondary">
            Back to Author Guidelines
          </Link>
        </div>
      </section>

      <section className="submission-guide__panel">
        <div className="submission-guide__panelHeader">
          <div>
            <p className="submission-guide__eyebrow">At A Glance</p>
            <h2>What you need before you submit</h2>
          </div>
        </div>

        <div className="submission-guide__fileGrid">
          {FILE_GUIDE.map((item) => (
            <article key={item.label} className="submission-guide__fileCard">
              <p className="submission-guide__fileLabel">{item.label}</p>
              <h3>{item.type}</h3>
              <p>{item.details}</p>
              <span>{item.accept}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="submission-guide__panel">
        <div className="submission-guide__panelHeader">
          <div>
            <p className="submission-guide__eyebrow">Submission Flow</p>
            <h2>Five clear steps</h2>
          </div>
        </div>

        <div className="submission-guide__steps">
          {STEPS.map((step) => (
            <article key={step.number} className="submission-guide__step">
              <div className="submission-guide__stepNumber">{step.number}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="submission-guide__panel submission-guide__panel--soft">
        <div className="submission-guide__panelHeader">
          <div>
            <p className="submission-guide__eyebrow">Checklist</p>
            <h2>Before you click submit</h2>
          </div>
        </div>

        <ul className="submission-guide__checklist">
          <li>The title and abstract are complete.</li>
          <li>The lead author name matches the submitting account.</li>
          <li>All co-author names and emails are paired correctly.</li>
          <li>The PDF and Word files are the same manuscript version.</li>
          <li>Both files are under the size limit shown on the submission page.</li>
        </ul>
      </section>
    </main>
  );
}
