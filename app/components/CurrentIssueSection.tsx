// app/components/CurrentIssueSection.tsx
import IssueCard from "./IssueCard";
import Link from "next/link";

export default function CurrentIssueSection() {
  const articles = [
    { title: "Including Kidney Health in the National Public Health Agenda: The Time is Now", authors: "Sumana Vasishta, Vivekanand Jha", kind: "Editorial" },
    { title: "Evaluating Pioglitazone for Managing Type 2 Diabetes Mellitus in Patients with...", authors: "Vijay Panikar, Apoorva Gupta", kind: "Original Article" },
    { title: "Oral Iron Absorption Test as a Predictor of Response to Oral Iron Therapy...", authors: "Sanyam Gaur, Vishnu Sharma", kind: "Original Article" },
    { title: "Trends in Glomerular Diseases in Northwest India: Has COVID-19 Altered the Diagnostic...", authors: "Abhishek P Singh, Jaydeep R Damor", kind: "Original Article" },
    { title: "Retrospective Observational Electronic Medical Records-based Real World Study t...", authors: "Vasu P Kanuru, Jamshed Dalal", kind: "Original Article" },
    { title: "Effect of Sleep Quality on Heart Rate Variability in Medical Students: A Cross...", authors: "Prachi Dawer, Kaushal Kumar Alam", kind: "Original Article" },
  ];

  return (
    <section className="bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Current Issue</h2>
          <Link href="/issues" className="text-sm text-gray-700 hover:underline">View All →</Link>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          <div className="space-y-4">
            <div className="bg-white border rounded overflow-hidden shadow-sm">
              <img src="/issue-cover.png" alt="Issue cover" className="w-full object-contain" />
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/issue/view" className="inline-flex items-center justify-between px-4 py-2 bg-gray-700 text-white rounded">
                <span>View Issue</span>
                <span className="ml-2">→</span>
              </Link>

              <a href="/issue/download.pdf" className="inline-flex items-center justify-between px-4 py-2 bg-gray-200 text-gray-800 rounded">
                <span>Download Issue</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((a, i) => (
                <IssueCard key={i} title={a.title} authors={a.authors} kind={a.kind} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
