import { supabaseServer } from "../../../lib/supabaseServer";
import { requireEditor } from "../../../lib/adminAuth";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";

function parseAuthors(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;

    const { manuscript_id, status, message } = req.body || {};
    if (!manuscript_id) {
      return res.status(400).json({ error: "Missing manuscript_id" });
    }

    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select("id, title, authors, author_id, submitter_id, status")
      .eq("id", manuscript_id)
      .maybeSingle();

    if (mErr || !manuscript) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    const authors = parseAuthors(manuscript.authors);
    const recipients = new Set();
    authors.forEach((a) => {
      if (a?.email) recipients.add(a.email);
    });

    const profileIds = Array.from(
      new Set([manuscript.author_id, manuscript.submitter_id].filter(Boolean))
    );
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("profiles")
        .select("id, email")
        .in("id", profileIds);

      (profiles || []).forEach((p) => {
        if (p?.email) recipients.add(p.email);
      });
    }

    const title = manuscript.title || "Manuscript";
    const effectiveStatus = status || manuscript.status || "submitted";
    const subject = `Status update: ${title}`;
    const bodyText =
      message || `Your manuscript status is now ${effectiveStatus}.`;

    if (RESEND_API_KEY && recipients.size) {
      const html = `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h2 style="color: #6A3291; margin-bottom: 12px;">Submission update</h2>
          <p>${bodyText}</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Status:</strong> ${effectiveStatus}</p>
          <p><strong>Submission ID:</strong> ${manuscript.id}</p>
          <p style="margin-top: 16px;">- Editorial Office</p>
        </div>
      `;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: Array.from(recipients),
          subject,
          html,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to send email");
      }
    }

    try {
      const rows = profileIds.map((user_id) => ({
        user_id,
        manuscript_id,
        title: "Manuscript status update",
        body: bodyText,
      }));

      if (rows.length) {
        await supabaseServer.from("notifications").insert(rows);
      }
    } catch (err) {
      console.warn("notification insert failed:", err);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin notify error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
