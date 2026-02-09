import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireEditor } from "../../../../lib/adminAuth";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";

async function sendReviewerEmail(recipient, manuscriptId) {
  if (!RESEND_API_KEY || !recipient) return;

  const subject = "Review request: new manuscript assigned";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">New review assigned</h2>
      <p>You have been assigned a manuscript to review.</p>
      <p><strong>Submission ID:</strong> ${manuscriptId}</p>
      <p>Please sign in to the admin portal to view the files and submit your recommendation.</p>
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
      to: [recipient],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Failed to send reviewer email");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireEditor(req, res);
    if (!auth) return;

    const { manuscript_id, reviewer_id, reviewer_email } = req.body || {};

    if (!manuscript_id) {
      return res.status(400).json({ error: "Missing manuscript_id" });
    }

    let reviewerId = reviewer_id;
    let reviewerEmail = reviewer_email || null;

    if (!reviewerId && reviewer_email) {
      const { data: reviewerProfile, error: rErr } = await supabaseServer
        .from("profiles")
        .select("id, role, approved, email")
        .eq("email", reviewer_email)
        .maybeSingle();

      if (rErr || !reviewerProfile) {
        return res.status(404).json({ error: "Reviewer not found" });
      }

      if (reviewerProfile.role !== "reviewer" || reviewerProfile.approved !== true) {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      reviewerId = reviewerProfile.id;
      reviewerEmail = reviewerProfile.email;
    }

    if (!reviewerId) {
      return res
        .status(400)
        .json({ error: "Missing reviewer_id or reviewer_email" });
    }

    if (!reviewerEmail && reviewerId) {
      const { data: reviewerProfile } = await supabaseServer
        .from("profiles")
        .select("email, role, approved")
        .eq("id", reviewerId)
        .maybeSingle();

      if (reviewerProfile?.role && reviewerProfile.role !== "reviewer") {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      if (reviewerProfile?.approved === false) {
        return res.status(400).json({ error: "Reviewer is not approved" });
      }

      reviewerEmail = reviewerProfile?.email || null;
    }

    const { data: existing } = await supabaseServer
      .from("manuscript_reviews")
      .select("id, manuscript_id, reviewer_id, recommendation, created_at")
      .eq("manuscript_id", manuscript_id)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ ok: true, review: existing });
    }

    const { data: review, error: reviewErr } = await supabaseServer
      .from("manuscript_reviews")
      .insert({
        manuscript_id,
        reviewer_id: reviewerId,
      })
      .select()
      .single();

    if (reviewErr) throw reviewErr;

    await supabaseServer
      .from("manuscripts")
      .update({ status: "under_review" })
      .eq("id", manuscript_id)
      .eq("status", "submitted");

    try {
      await supabaseServer.from("notifications").insert([
        {
          user_id: reviewerId,
          manuscript_id,
          title: "New review assigned",
          body: "You have been assigned a new manuscript to review.",
        },
      ]);
    } catch (err) {
      console.warn("notification insert failed:", err);
    }

    if (reviewerEmail) {
      try {
        await sendReviewerEmail(reviewerEmail, manuscript_id);
      } catch (err) {
        console.warn("reviewer email failed:", err);
      }
    }

    return res.status(200).json({ ok: true, review });
  } catch (err) {
    console.error("assign reviewer error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
