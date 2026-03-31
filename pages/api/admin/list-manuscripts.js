// pages/api/admin/list-manuscripts.js
import { supabaseServer } from "../../../lib/supabaseServer";
import { requireEditor } from "../../../lib/adminAuth";

function resolveIssueId(raw) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

function buildIssueLabel(issue) {
  if (!issue) return "Issue";

  const volume = issue.volume ? `Vol. ${issue.volume}` : null;
  const issueNumber =
    issue.issue_number != null ? `Issue ${issue.issue_number}` : null;
  const title = issue.title ? String(issue.title).trim() : null;

  const compact = [volume, issueNumber].filter(Boolean).join(", ");
  if (title && compact) {
    return `${compact} — ${title}`;
  }

  return title || compact || "Issue";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;
    const currentIssueId = resolveIssueId(req.query.issueId);

    const { data, error } = await supabaseServer
      .from("manuscripts")
      .select("id, title, authors, status, submitter_id, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const manuscripts = data || [];
    const manuscriptIds = manuscripts.map((row) => row.id).filter(Boolean);

    let articlesByManuscriptId = new Map();
    if (manuscriptIds.length > 0) {
      const { data: articleRows, error: articleErr } = await supabaseServer
        .from("articles")
        .select("manuscript_id, issue_id, created_at")
        .not("manuscript_id", "is", null)
        .in("manuscript_id", manuscriptIds)
        .order("created_at", { ascending: false });

      if (articleErr) throw articleErr;

      const issueIds = Array.from(
        new Set(
          (articleRows || [])
            .map((row) => row.issue_id)
            .filter((value) => typeof value === "string" && value)
        )
      );

      let issuesById = new Map();
      if (issueIds.length > 0) {
        const { data: issueRows, error: issueErr } = await supabaseServer
          .from("issues")
          .select("id, title, volume, issue_number, published_at")
          .in("id", issueIds);

        if (issueErr) throw issueErr;

        issuesById = new Map((issueRows || []).map((row) => [row.id, row]));
      }

      const nextMap = new Map();

      for (const row of articleRows || []) {
        if (!row.manuscript_id || !row.issue_id) {
          continue;
        }

        const manuscriptEntries = nextMap.get(row.manuscript_id) || [];
        const existing = manuscriptEntries.find(
          (entry) => entry.issue_id === row.issue_id
        );

        if (existing) {
          continue;
        }

        const issue = issuesById.get(row.issue_id) || null;
        manuscriptEntries.push({
          issue_id: row.issue_id,
          issue_title: issue?.title ?? null,
          issue_label: buildIssueLabel(issue),
          published_at: issue?.published_at ?? null,
          is_current_issue: currentIssueId ? row.issue_id === currentIssueId : false,
        });
        nextMap.set(row.manuscript_id, manuscriptEntries);
      }

      articlesByManuscriptId = nextMap;
    }

    const enrichedManuscripts = manuscripts.map((row) => {
      const issueLinks = (articlesByManuscriptId.get(row.id) || []).sort((a, b) => {
        const aDate = a?.published_at ? new Date(a.published_at).getTime() : 0;
        const bDate = b?.published_at ? new Date(b.published_at).getTime() : 0;
        return bDate - aDate;
      });

      const issueIds = issueLinks
        .map((entry) => entry.issue_id)
        .filter((value) => typeof value === "string" && value);

      const isInCurrentIssue = currentIssueId
        ? issueIds.includes(currentIssueId)
        : false;
      const isInOtherIssues = currentIssueId
        ? issueIds.some((value) => value !== currentIssueId)
        : issueIds.length > 0;

      return {
        ...row,
        issue_links: issueLinks,
        issue_count: issueLinks.length,
        is_in_any_issue: issueLinks.length > 0,
        is_in_current_issue: isInCurrentIssue,
        is_in_other_issues: isInOtherIssues,
      };
    });

    return res.status(200).json({ ok: true, manuscripts: enrichedManuscripts });
  } catch (err) {
    console.error("list-manuscripts error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
