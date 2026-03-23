import { supabaseServer } from "../../../lib/supabaseServer";
import {
  getOwnerNotificationEmails,
  normalizeEmail,
} from "../../../lib/accessControl";
import {
  ADMIN_REQUEST_EMAIL_COOLDOWN_MS,
  ADMIN_REQUEST_IP_MAX_REQUESTS_PER_WINDOW,
  ADMIN_REQUEST_IP_MIN_INTERVAL_MS,
  ADMIN_REQUEST_IP_WINDOW_MS,
  getAdminRequestClientFingerprint,
  getAdminRequestUserAgent,
  MAX_ADMIN_REQUEST_EMAIL_LENGTH,
  MAX_ADMIN_REQUEST_MESSAGE_LENGTH,
  MAX_ADMIN_REQUEST_NAME_LENGTH,
} from "../../../lib/adminRequestSecurity";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";
const GENERIC_SUCCESS_MESSAGE =
  "Request submitted. If approved, an owner or admin will contact you by email.";
const DUPLICATE_PENDING_MESSAGE =
  "We already have an open admin access request for this email. No need to submit another one.";
const INVITED_MESSAGE =
  "An admin invitation has already been sent to this email. Please check your inbox.";
const ALREADY_ADMIN_MESSAGE =
  "This email already has admin access. You can go straight to the admin login page.";
const COOLDOWN_MESSAGE =
  "Thanks - we received a recent request already. Please wait a little before sending another one.";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function notifyOwner({ name, email, message, createdAt }) {
  if (!RESEND_API_KEY) {
    return false;
  }

  const ownerEmails = await getOwnerNotificationEmails(supabaseServer);
  if (!ownerEmails.length) {
    return false;
  }

  const subject = `UpDAYtes Admin Access Request: ${name || email}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Admin Access Request</h2>
      <p>A new admin access request was submitted.</p>
      <p><strong>Name:</strong> ${escapeHtml(name || "Not provided")}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(createdAt)}</p>
      <p><strong>Reason:</strong></p>
      <div style="white-space: pre-wrap; background: #f9fafb; padding: 12px; border-radius: 8px;">${escapeHtml(
        message || "No reason provided."
      )}</div>
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
      to: ownerEmails,
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
    const email = normalizeEmail(req.body?.email);
    const message = String(req.body?.message || "").trim();
    const website = String(req.body?.website || "").trim();
    const now = new Date();
    const createdAt = now.toISOString();
    const clientFingerprint = getAdminRequestClientFingerprint(req);
    const userAgent = getAdminRequestUserAgent(req);

    // Hidden honeypot: real users never interact with this field.
    if (website) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        message: GENERIC_SUCCESS_MESSAGE,
      });
    }

    if (!name) {
      return res.status(400).json({ error: "Please provide your name." });
    }

    if (name.length > MAX_ADMIN_REQUEST_NAME_LENGTH) {
      return res.status(400).json({
        error: `Please keep your name under ${MAX_ADMIN_REQUEST_NAME_LENGTH} characters.`,
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }

    if (email.length > MAX_ADMIN_REQUEST_EMAIL_LENGTH) {
      return res.status(400).json({
        error: "Please provide a shorter email address.",
      });
    }

    if (!message) {
      return res
        .status(400)
        .json({ error: "Please provide a short reason for the request." });
    }

    if (message.length > MAX_ADMIN_REQUEST_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Please keep your reason under ${MAX_ADMIN_REQUEST_MESSAGE_LENGTH} characters.`,
      });
    }

    const { data: existingPrivilegedProfile, error: profileError } =
      await supabaseServer
        .from("profiles")
        .select("id")
        .eq("email", email)
        .in("role", ["owner", "admin"])
        .eq("approved", true)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (existingPrivilegedProfile?.id) {
      return res.status(200).json({
        ok: true,
        already_admin: true,
        message: ALREADY_ADMIN_MESSAGE,
      });
    }

    const { data: recentEmailRequests, error: recentEmailError } =
      await supabaseServer
        .from("admin_access_requests")
        .select("id, status, created_at")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(5);

    if (recentEmailError) {
      throw recentEmailError;
    }

    const latestEmailRequest = (recentEmailRequests || [])[0] || null;
    if (latestEmailRequest?.status === "pending") {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        message: DUPLICATE_PENDING_MESSAGE,
      });
    }

    if (latestEmailRequest?.status === "invited") {
      const { data: activeInvite, error: inviteLookupError } = await supabaseServer
        .from("admin_invites")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .gt("expires_at", createdAt)
        .limit(1)
        .maybeSingle();

      if (inviteLookupError) {
        throw inviteLookupError;
      }

      if (activeInvite?.id) {
        return res.status(200).json({
          ok: true,
          duplicate: true,
          message: INVITED_MESSAGE,
        });
      }
    }

    if (latestEmailRequest?.created_at) {
      const latestEmailRequestTime = new Date(latestEmailRequest.created_at).getTime();
      if (
        Number.isFinite(latestEmailRequestTime) &&
        now.getTime() - latestEmailRequestTime < ADMIN_REQUEST_EMAIL_COOLDOWN_MS
      ) {
        return res.status(429).json({ error: COOLDOWN_MESSAGE });
      }
    }

    if (clientFingerprint) {
      const windowStart = new Date(
        now.getTime() - ADMIN_REQUEST_IP_WINDOW_MS
      ).toISOString();

      const { data: recentIpRequests, error: recentIpError } = await supabaseServer
        .from("admin_access_requests")
        .select("created_at")
        .eq("ip_fingerprint", clientFingerprint)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(ADMIN_REQUEST_IP_MAX_REQUESTS_PER_WINDOW);

      if (recentIpError) {
        throw recentIpError;
      }

      const mostRecentIpRequest = (recentIpRequests || [])[0];
      if (mostRecentIpRequest?.created_at) {
        const mostRecentIpTime = new Date(mostRecentIpRequest.created_at).getTime();
        if (
          Number.isFinite(mostRecentIpTime) &&
          now.getTime() - mostRecentIpTime < ADMIN_REQUEST_IP_MIN_INTERVAL_MS
        ) {
          return res.status(429).json({ error: COOLDOWN_MESSAGE });
        }
      }

      if ((recentIpRequests || []).length >= ADMIN_REQUEST_IP_MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
          error:
            "We have already received several recent requests from this network. Please try again a little later.",
        });
      }
    }

    const record = {
      name,
      email,
      message,
      status: "pending",
      ip_fingerprint: clientFingerprint,
      user_agent: userAgent,
    };

    const { error: insertErr } = await supabaseServer
      .from("admin_access_requests")
      .insert(record);

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

    return res.status(200).json({
      ok: true,
      emailed,
      message: emailed
        ? "Request submitted. The owner has been notified and can invite you if approved."
        : GENERIC_SUCCESS_MESSAGE,
    });
  } catch (err) {
    console.error("request admin access error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
