// pages/api/admin/update-manuscript-status.js
import { supabaseServer } from "../../../lib/supabaseServer";
import { requireEditor } from "../../../lib/adminAuth";

const ALLOWED_STATUSES = [
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "published",
  "revisions_requested",
];

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

async function createNotifications(userIds, payload) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;

  const rows = unique.map((user_id) => ({
    user_id,
    manuscript_id: payload.manuscript_id,
    title: payload.title,
    body: payload.body,
  }));

  try {
    await supabaseServer.from("notifications").insert(rows);
  } catch (err) {
    console.warn("notification insert failed:", err);
  }
}

async function sendStatusEmail(recipients, manuscript, status) {
  if (!RESEND_API_KEY || recipients.length === 0) return;

  const title = manuscript.title || "Manuscript";
  const subject = `Status update: ${title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Submission update</h2>
      <p>Your manuscript status has been updated.</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Status:</strong> ${status}</p>
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
      to: recipients,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Failed to send email");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { manuscriptId, status } = req.body || {};

    if (!manuscriptId || typeof manuscriptId !== "string") {
      return res.status(400).json({ error: "Missing or invalid manuscriptId" });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const auth = await requireEditor(req, res);
    if (!auth) return;

    const { data, error } = await supabaseServer
      .from("manuscripts")
      .update({ status })
      .eq("id", manuscriptId)
      .select("id, title, status, created_at, submitter_id, author_id, authors")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    const authors = parseAuthors(data.authors);
    const recipientEmails = new Set();
    authors.forEach((a) => {
      if (a?.email) recipientEmails.add(a.email);
    });

    const profileIds = Array.from(
      new Set([data.author_id, data.submitter_id].filter(Boolean))
    );
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("profiles")
        .select("id, email")
        .in("id", profileIds);

      (profiles || []).forEach((p) => {
        if (p?.email) recipientEmails.add(p.email);
      });
    }

    try {
      await sendStatusEmail(Array.from(recipientEmails), data, status);
    } catch (err) {
      console.warn("status email failed:", err);
    }

    await createNotifications(profileIds, {
      manuscript_id: data.id,
      title: "Manuscript status updated",
      body: `Status changed to ${status}.`,
    });

    return res.status(200).json({ ok: true, manuscript: data });
  } catch (err) {
    console.error("update-manuscript-status error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
