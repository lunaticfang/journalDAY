import { supabaseServer } from "../../../lib/supabaseServer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

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
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: authErr } =
      await supabaseServer.auth.getUser(token);

    if (authErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const { manuscript_id } = req.body || {};
    if (!manuscript_id) {
      return res.status(400).json({ error: "Missing manuscript_id" });
    }

    const { data: manuscript, error: mErr } = await supabaseServer
      .from("manuscripts")
      .select("id, title, authors, author_id, submitter_id")
      .eq("id", manuscript_id)
      .maybeSingle();

    if (mErr || !manuscript) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    if (
      manuscript.author_id !== userData.user.id &&
      manuscript.submitter_id !== userData.user.id
    ) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: "Missing RESEND_API_KEY" });
    }

    const authors = parseAuthors(manuscript.authors);
    const recipients = new Set();
    authors.forEach((a) => {
      if (a?.email) recipients.add(a.email);
    });

    if (userData.user.email) {
      recipients.add(userData.user.email);
    }

    const toList = Array.from(recipients);
    if (!toList.length) {
      return res.status(400).json({ error: "No recipient emails found" });
    }

    const title = manuscript.title || "Manuscript";
    const subject = `Submission received: ${title}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2 style="color: #6A3291; margin-bottom: 12px;">Submission received</h2>
        <p>Thank you for submitting your manuscript to UpDAYtes.</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Submission ID:</strong> ${manuscript.id}</p>
        <p>We will review your submission and notify you of any updates.</p>
        <p style="margin-top: 16px;">— Editorial Office</p>
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
        to: toList,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || "Failed to send email");
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("notify submission error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
