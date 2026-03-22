import { supabaseServer } from "../../../lib/supabaseServer";
import { OWNER_EMAIL } from "../../../lib/isOwner";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createRequestKey() {
  return `admin_access_request.${Date.now()}.${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

async function notifyOwner({ name, email, message, createdAt }) {
  if (!RESEND_API_KEY) {
    return false;
  }

  const subject = `UpDAYtes Admin Access Request: ${name || email}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Admin Access Request</h2>
      <p>A new admin access request was submitted.</p>
      <p><strong>Name:</strong> ${name || "Not provided"}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Submitted:</strong> ${createdAt}</p>
      <p><strong>Reason:</strong></p>
      <div style="white-space: pre-wrap; background: #f9fafb; padding: 12px; border-radius: 8px;">${
        message || "No reason provided."
      }</div>
      <p style="margin-top: 18px;">If approved, invite this user from the Admin Management page.</p>
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
      to: [OWNER_EMAIL],
      subject,
      html,
      reply_to: email,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Failed to send request email");
  }

  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const message = String(req.body?.message || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Please provide your name." });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }

    if (!message) {
      return res
        .status(400)
        .json({ error: "Please provide a short reason for the request." });
    }

    const createdAt = new Date().toISOString();
    const record = {
      type: "admin_access_request",
      status: "pending",
      name,
      email,
      message,
      created_at: createdAt,
    };

    const { error: insertErr } = await supabaseServer.from("site_content").insert({
      key: createRequestKey(),
      value: JSON.stringify(record),
    });

    if (insertErr) {
      throw insertErr;
    }

    let emailed = false;

    try {
      emailed = await notifyOwner({
        name,
        email,
        message,
        createdAt,
      });
    } catch (emailErr) {
      console.error("admin request email error:", emailErr);
    }

    return res.status(200).json({ ok: true, emailed });
  } catch (err) {
    console.error("request admin access error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
