import { supabaseServer } from "../../../lib/supabaseServer";
import { respondWithApiError } from "../../../lib/apiError";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function sortReviewsNewestFirst(left, right) {
  const leftTs = new Date(left?.decided_at || left?.created_at || 0).getTime();
  const rightTs = new Date(right?.decided_at || right?.created_at || 0).getTime();
  return rightTs - leftTs;
}

function getErrorMessage(err) {
  return String(err?.message || err || "").toLowerCase();
}

function isMissingTableError(err, tableName) {
  const message = getErrorMessage(err);
  const normalizedTable = String(tableName || "").toLowerCase();
  if (!message || !normalizedTable) return false;

  return (
    message.includes(`relation "public.${normalizedTable}" does not exist`) ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    message.includes(`table '${normalizedTable}'`) ||
    message.includes(`table "${normalizedTable}"`) ||
    message.includes(`from '${normalizedTable}'`) ||
    message.includes(`from "${normalizedTable}"`) ||
    message.includes(`of '${normalizedTable}'`) ||
    message.includes(`of "${normalizedTable}"`)
  );
}

function isMissingColumnError(err, tableName, columnNames = []) {
  const message = getErrorMessage(err);
  if (!message) return false;

  const normalizedTable = String(tableName || "").toLowerCase();
  if (normalizedTable && !message.includes(normalizedTable)) {
    return false;
  }

  return columnNames.some((columnName) => {
    const normalizedColumn = String(columnName || "").toLowerCase();
    return normalizedColumn && message.includes(normalizedColumn);
  });
}

function buildIssueLabel(issue) {
  if (!issue) return "Issue";

  const volume = issue.volume ? `Vol. ${issue.volume}` : null;
  const issueNumber =
    issue.issue_number != null ? `Issue ${issue.issue_number}` : null;
  const title = issue.title ? String(issue.title).trim() : null;

  const compact = [volume, issueNumber].filter(Boolean).join(", ");
  if (title && compact) {
    return `${compact} - ${title}`;
  }

  return title || compact || "Issue";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: authErr } =
      await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const userId = userData.user.id;

    let hasCurrentVersionColumn = true;
    let manuscriptRows = [];

    let manuscriptsResp = await supabaseServer
      .from("manuscripts")
      .select(
        "id, title, status, created_at, author_id, submitter_id, current_version"
      )
      .or(`author_id.eq.${userId},submitter_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (
      manuscriptsResp.error &&
      isMissingColumnError(manuscriptsResp.error, "manuscripts", ["current_version"])
    ) {
      hasCurrentVersionColumn = false;
      manuscriptsResp = await supabaseServer
        .from("manuscripts")
        .select("id, title, status, created_at, author_id, submitter_id")
        .or(`author_id.eq.${userId},submitter_id.eq.${userId}`)
        .order("created_at", { ascending: false });
    }

    if (manuscriptsResp.error) throw manuscriptsResp.error;

    manuscriptRows = (manuscriptsResp.data || []).map((row) => ({
      ...row,
      current_version: hasCurrentVersionColumn ? row.current_version ?? null : null,
    }));

    const manuscriptIds = manuscriptRows.map((row) => row.id).filter(Boolean);
    const currentVersionIds = manuscriptRows
      .map((row) => row.current_version)
      .filter(Boolean);

    let versionsById = new Map();
    if (hasCurrentVersionColumn && currentVersionIds.length) {
      let versionsResp = await supabaseServer
        .from("manuscript_versions")
        .select("id, manuscript_id, created_at")
        .in("id", currentVersionIds);

      if (
        versionsResp.error &&
        isMissingColumnError(versionsResp.error, "manuscript_versions", [
          "created_at",
        ])
      ) {
        versionsResp = await supabaseServer
          .from("manuscript_versions")
          .select("id, manuscript_id")
          .in("id", currentVersionIds);
      }

      if (versionsResp.error) {
        if (!isMissingTableError(versionsResp.error, "manuscript_versions")) {
          throw versionsResp.error;
        }
      } else {
        const versionRows = (versionsResp.data || []).map((row) => ({
          ...row,
          created_at: row.created_at || null,
        }));
        versionsById = new Map(versionRows.map((row) => [row.id, row]));
      }
    }

    let feedbackByManuscriptId = new Map();
    if (manuscriptIds.length) {
      const { data: reviews, error: reviewsErr } = await supabaseServer
        .from("manuscript_reviews")
        .select("id, manuscript_id, recommendation, notes, decided_at, created_at")
        .in("manuscript_id", manuscriptIds)
        .not("recommendation", "is", null);

      if (reviewsErr) {
        if (!isMissingTableError(reviewsErr, "manuscript_reviews")) {
          throw reviewsErr;
        }
      } else {
        const grouped = new Map();
        (reviews || []).forEach((review) => {
          if (!review?.manuscript_id) return;
          if (!grouped.has(review.manuscript_id)) {
            grouped.set(review.manuscript_id, []);
          }
          grouped.get(review.manuscript_id).push(review);
        });

        grouped.forEach((entries, manuscriptId) => {
          const sorted = entries.sort(sortReviewsNewestFirst);
          const latest = sorted[0];
          if (!latest) return;
          feedbackByManuscriptId.set(manuscriptId, {
            recommendation: latest.recommendation || null,
            notes: latest.notes || null,
            decided_at: latest.decided_at || null,
            review_id: latest.id || null,
          });
        });
      }
    }

    let latestIssueId = null;
    try {
      const { data: latestIssue } = await supabaseServer
        .from("issues")
        .select("id")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestIssue?.id) {
        latestIssueId = latestIssue.id;
      }
    } catch {
      latestIssueId = null;
    }

    let issueLinksByManuscriptId = new Map();
    if (manuscriptIds.length) {
      let articleRows = [];
      let articleErr = null;

      const primaryArticlesResp = await supabaseServer
        .from("articles")
        .select("manuscript_id, issue_id, created_at")
        .in("manuscript_id", manuscriptIds)
        .not("issue_id", "is", null)
        .order("created_at", { ascending: false });

      articleRows = primaryArticlesResp.data || [];
      articleErr = primaryArticlesResp.error || null;

      if (
        articleErr &&
        isMissingColumnError(articleErr, "articles", ["created_at"])
      ) {
        const fallbackArticlesResp = await supabaseServer
          .from("articles")
          .select("manuscript_id, issue_id")
          .in("manuscript_id", manuscriptIds)
          .not("issue_id", "is", null);

        articleRows = (fallbackArticlesResp.data || []).map((row) => ({
          ...row,
          created_at: null,
        }));
        articleErr = fallbackArticlesResp.error || null;
      }

      if (articleErr) {
        if (
          isMissingTableError(articleErr, "articles") ||
          isMissingColumnError(articleErr, "articles", ["issue_id", "manuscript_id"])
        ) {
          articleRows = [];
        } else {
          throw articleErr;
        }
      }

      const issueIds = Array.from(
        new Set(
          (articleRows || [])
            .map((row) => row.issue_id)
            .filter((value) => typeof value === "string" && value)
        )
      );

      let issuesById = new Map();
      if (issueIds.length) {
        const { data: issueRows, error: issueErr } = await supabaseServer
          .from("issues")
          .select("id, title, volume, issue_number, published_at")
          .in("id", issueIds);

        if (issueErr) {
          if (!isMissingTableError(issueErr, "issues")) {
            throw issueErr;
          }
        } else {
          issuesById = new Map((issueRows || []).map((row) => [row.id, row]));
        }
      }

      const map = new Map();
      for (const row of articleRows || []) {
        if (!row?.manuscript_id || !row?.issue_id) continue;

        const links = map.get(row.manuscript_id) || [];
        if (links.some((entry) => entry.issue_id === row.issue_id)) {
          continue;
        }

        const issue = issuesById.get(row.issue_id) || null;
        links.push({
          issue_id: row.issue_id,
          issue_title: issue?.title ?? null,
          issue_label: buildIssueLabel(issue),
          published_at: issue?.published_at ?? null,
          is_current_issue: latestIssueId ? row.issue_id === latestIssueId : false,
        });
        map.set(row.manuscript_id, links);
      }

      issueLinksByManuscriptId = map;
    }

    const rows = manuscriptRows.map((manuscript) => {
      const version = manuscript.current_version
        ? versionsById.get(manuscript.current_version) || null
        : null;
      const latestFeedback = feedbackByManuscriptId.get(manuscript.id) || null;
      const issueLinks = (issueLinksByManuscriptId.get(manuscript.id) || []).sort(
        (left, right) => {
          const leftTs = left?.published_at
            ? new Date(left.published_at).getTime()
            : 0;
          const rightTs = right?.published_at
            ? new Date(right.published_at).getTime()
            : 0;
          return rightTs - leftTs;
        }
      );
      const issueIds = issueLinks
        .map((entry) => entry.issue_id)
        .filter((value) => typeof value === "string" && value);

      return {
        ...manuscript,
        issue_links: issueLinks,
        issue_count: issueLinks.length,
        is_in_any_issue: issueLinks.length > 0,
        is_in_current_issue: latestIssueId ? issueIds.includes(latestIssueId) : false,
        is_in_previous_issue: latestIssueId
          ? issueIds.some((value) => value !== latestIssueId)
          : issueLinks.length > 0,
        latest_version: version
          ? {
              id: version.id,
              created_at: version.created_at,
            }
          : null,
        latest_feedback: latestFeedback,
      };
    });

    return res.status(200).json({
      ok: true,
      latest_issue_id: latestIssueId,
      manuscripts: rows,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "author-dashboard",
      err,
      "Failed to load author dashboard."
    );
  }
}
