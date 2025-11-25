// app/components/IssueCard.tsx
export default function IssueCard({ title, authors, kind }: { title: string; authors: string; kind?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded shadow-sm p-4">
      {kind && <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{kind}</div>}
      <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">{title}</h3>
      <div className="text-xs text-gray-600">{authors}</div>
    </div>
  );
}
