import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import {
  getAppBaseUrl,
  getInviteSecret,
  randomPassword,
  verifyInviteToken,
} from "../../../../lib/adminInviteToken";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "no-reply@updaytesjournal.com";

async function findAuthUserByEmail(email: string) {
  const { data, error } = await supabaseServer.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  return (data.users || []).find(
    (u: any) => String(u.email || "").toLowerCase() === email.toLowerCase()
  );
}

async function sendSecondEmail(recipient: string, actionLink: string) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const subject = "Your UpDAYtes Admin Access Is Ready";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Admin Access Approved</h2>
      <p>Your admin invitation has been confirmed.</p>
      <p>Set your password using the secure link below:</p>
      <p style="margin: 16px 0;">
        <a href="${actionLink}" style="background:#6A3291;color:white;padding:10px 14px;border-radius:6px;text-decoration:none;">
          Set Password & Activate Admin Access
        </a>
      </p>
      <p>After setting your password, sign in at the Admin Login page.</p>
      <p style="margin-top: 18px;">For security, this link may expire. Request a new invite if needed.</p>
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
    throw new Error(text || "Failed to send password setup email");
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Missing invite token" });
    }

    const secret = getInviteSecret();
    if (!secret) {
      return res.status(500).json({
        error: "Missing ADMIN_INVITE_SECRET (or fallback secret) on server",
      });
    }

    const payload = verifyInviteToken(token, secret);
    if (!payload) {
      return res.status(400).json({ error: "Invite is invalid or expired" });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Invite payload is invalid" });
    }

    let user = await findAuthUserByEmail(email);

    if (!user) {
      const { data: created, error: createErr } =
        await supabaseServer.auth.admin.createUser({
          email,
          password: randomPassword(),
          email_confirm: true,
        });

      if (createErr) {
        return res.status(500).json({ error: createErr.message || "Could not create user" });
      }

      user = created.user;
    }

    if (!user?.id) {
      return res.status(500).json({ error: "Could not resolve invited user id" });
    }

    const { error: profileErr } = await supabaseServer
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email,
          role: "admin",
          approved: true,
        },
        { onConflict: "id" }
      );

    if (profileErr) {
      return res.status(500).json({ error: profileErr.message || "Failed to grant admin role" });
    }

    const baseUrl = getAppBaseUrl(req);
    const { data: linkData, error: linkErr } = await supabaseServer.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${baseUrl}/admin/login`,
      },
    });

    if (linkErr) {
      return res
        .status(500)
        .json({ error: linkErr.message || "Failed to generate password setup link" });
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return res.status(500).json({ error: "No password setup link returned by auth provider" });
    }

    await sendSecondEmail(email, actionLink);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("accept admin invite error:", err);
    return res.status(500).json({ error: err?.message || "Failed to accept invite" });
  }
}

