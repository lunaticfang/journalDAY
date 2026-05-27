import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import {
  createInviteToken,
  getAppBaseUrl,
  getInviteTtlHours,
  hashInviteToken,
} from "../../../../lib/adminInviteToken";
import { sendTransactionalEmail } from "../../../../lib/transactionalEmail";
import { respondWithApiError } from "../../../../lib/apiError";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendInviteEmail(recipient: string, approveUrl: string, inviterEmail: string | null) {
  const subject = "UpDAYtes Admin Invite - Confirm Access";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="color: #6A3291; margin-bottom: 12px;">Admin Invitation</h2>
      <p>You were invited to become an administrator at UpDAYtes.</p>
      <p><strong>Invited by:</strong> ${inviterEmail || "UpDAYtes Owner/Admin"}</p>
      <p>To continue, confirm this invitation:</p>
      <p style="margin: 16px 0;">
        <a href="${approveUrl}" style="background:#6A3291;color:white;padding:10px 14px;border-radius:6px;text-decoration:none;">
          Approve Admin Invitation
        </a>
      </p>
      <p>This link expires in 7 days.</p>
      <p style="margin-top: 18px;">If you did not expect this invite, ignore this email.</p>
    </div>
  `;
  const text = [
    "Admin Invitation",
    "",
    "You were invited to become an administrator at UpDAYtes.",
    `Invited by: ${inviterEmail || "UpDAYtes Owner/Admin"}`,
    "",
    `Confirm invitation: ${approveUrl}`,
    "",
    "This link expires in 7 days.",
  ].join("\n");

  await sendTransactionalEmail({
    to: [recipient],
    subject,
    html,
    text,
    tags: ["admin", "invite"],
  });
}

function respondInvitePipelineError(
  res: NextApiResponse,
  step: string,
  err: unknown,
  fallbackMessage: string,
  meta: Record<string, unknown> = {}
) {
  return respondWithApiError(
    res,
    500,
    `admin-users-invite-${step}`,
    err,
    fallbackMessage,
    meta
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res, ["admin"]);
    if (!auth) return;

    const email = String(req.body?.email || "").trim().toLowerCase();
    const requestId = String(req.body?.requestId || "").trim() || null;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email" });
    }

    const { data: existingProfile } = await supabaseServer
      .from("profiles")
      .select("id, role, approved")
      .eq("email", email)
      .maybeSingle();

    if (
      existingProfile?.approved === true &&
      ["owner", "admin"].includes(String(existingProfile.role || ""))
    ) {
      return res.status(200).json({ ok: true, already_admin: true });
    }

    if (requestId) {
      const { data: existingRequest, error: requestError } = await supabaseServer
        .from("admin_access_requests")
        .select("id, email, status")
        .eq("id", requestId)
        .maybeSingle();

      if (requestError) {
        return respondInvitePipelineError(
          res,
          "request-lookup",
          requestError,
          "Could not load admin access request.",
          { requestId, email }
        );
      }

      if (!existingRequest) {
        return res.status(404).json({ error: "Admin access request not found" });
      }

      if (String(existingRequest.email || "").trim().toLowerCase() !== email) {
        return res.status(400).json({ error: "Request email does not match invite email" });
      }

      const requestStatus = String(existingRequest.status || "")
        .trim()
        .toLowerCase();
      if (requestStatus && !["pending", "invited"].includes(requestStatus)) {
        return res.status(400).json({
          error: `Request is already ${requestStatus} and cannot be invited.`,
        });
      }
    }

    const ttlHours = getInviteTtlHours();
    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    const tokenHash = hashInviteToken(token);

    const { error: revokeErr } = await supabaseServer
      .from("admin_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: auth.user.id,
        revoked_by_email: auth.user.email ?? auth.profile?.email ?? null,
      })
      .eq("email", email)
      .eq("status", "pending");

    if (revokeErr) {
      return respondInvitePipelineError(
        res,
        "revoke-existing",
        revokeErr,
        "Could not revoke prior pending invites.",
        { email, requestId }
      );
    }

    const { error: inviteErr } = await supabaseServer.from("admin_invites").insert({
      email,
      inviter_id: auth.user.id,
      inviter_email: auth.user.email ?? auth.profile?.email ?? null,
      request_id: requestId,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
    });

    if (inviteErr) {
      return respondInvitePipelineError(
        res,
        "store-invite",
        inviteErr,
        "Could not store admin invite.",
        { email, requestId }
      );
    }

    const baseUrl = getAppBaseUrl(req);
    const approveUrl = `${baseUrl}/admin-invite/accept?token=${encodeURIComponent(token)}`;

    try {
      await sendInviteEmail(email, approveUrl, auth.user.email ?? null);
    } catch (emailErr) {
      // Do not leave a "pending" invite row if email delivery failed.
      await supabaseServer
        .from("admin_invites")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: auth.user.id,
          revoked_by_email: auth.user.email ?? auth.profile?.email ?? null,
        })
        .eq("token_hash", tokenHash)
        .eq("status", "pending");

      return respondInvitePipelineError(
        res,
        "email-send",
        emailErr,
        "Could not send invite email.",
        { email, requestId }
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return respondWithApiError(
      res,
      500,
      "admin-users-invite",
      err,
      "Failed to send invite."
    );
  }
}
