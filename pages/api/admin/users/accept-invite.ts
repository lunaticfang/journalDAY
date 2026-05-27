import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import {
  getAppBaseUrl,
  hashInviteToken,
  randomPassword,
} from "../../../../lib/adminInviteToken";
import { findAuthUserByEmail } from "../../../../lib/adminBootstrap";
import { sendTransactionalEmail } from "../../../../lib/transactionalEmail";
import { respondWithApiError } from "../../../../lib/apiError";

function respondAcceptInvitePipelineError(
  res: NextApiResponse,
  step: string,
  err: unknown,
  fallbackMessage: string,
  meta: Record<string, unknown> = {}
) {
  return respondWithApiError(
    res,
    500,
    `admin-users-accept-invite-${step}`,
    err,
    fallbackMessage,
    meta
  );
}

async function sendSecondEmail(recipient: string, actionLink: string) {
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
  const text = [
    "Admin Access Approved",
    "",
    "Your UpDAYtes admin invitation has been confirmed.",
    `Set your password: ${actionLink}`,
    "",
    "After setting your password, sign in at the Admin Login page.",
  ].join("\n");

  await sendTransactionalEmail({
    to: [recipient],
    subject,
    html,
    text,
    tags: ["admin", "invite-approved"],
  });
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

    const tokenHash = hashInviteToken(token);
    const { data: invite, error: inviteErr } = await supabaseServer
      .from("admin_invites")
      .select("id, email, request_id, status, expires_at, used_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteErr) {
      return respondAcceptInvitePipelineError(
        res,
        "invite-lookup",
        inviteErr,
        "Could not validate invite token."
      );
    }

    if (!invite) {
      return res.status(400).json({ error: "Invite is invalid or expired" });
    }

    if (invite.status !== "pending" || invite.used_at || invite.revoked_at) {
      return res.status(400).json({ error: "Invite has already been used or revoked" });
    }

    if (!invite.expires_at || new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Invite is invalid or expired" });
    }

    const email = String(invite.email || "").trim().toLowerCase();
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
        return respondAcceptInvitePipelineError(
          res,
          "create-user",
          createErr,
          "Could not provision invited account.",
          { email }
        );
      }

      user = created.user;
    }

    if (!user?.id) {
      return respondAcceptInvitePipelineError(
        res,
        "resolve-user-id",
        new Error("Invited user resolved without id."),
        "Could not resolve invited account."
      );
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
      return respondAcceptInvitePipelineError(
        res,
        "grant-role",
        profileErr,
        "Could not grant admin access.",
        { email, userId: user.id }
      );
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
      return respondAcceptInvitePipelineError(
        res,
        "password-link",
        linkErr,
        "Could not generate password setup link.",
        { email }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return respondAcceptInvitePipelineError(
        res,
        "missing-password-link",
        new Error("Auth provider did not return action_link."),
        "Could not prepare password setup link.",
        { email }
      );
    }

    try {
      await sendSecondEmail(email, actionLink);
    } catch (emailErr) {
      return respondAcceptInvitePipelineError(
        res,
        "send-activation-email",
        emailErr,
        "Could not send admin activation email.",
        { email }
      );
    }

    const timestamp = new Date().toISOString();

    const { error: inviteUpdateErr } = await supabaseServer
      .from("admin_invites")
      .update({
        status: "used",
        used_at: timestamp,
      })
      .eq("id", invite.id);

    if (inviteUpdateErr) {
      return respondAcceptInvitePipelineError(
        res,
        "mark-invite-used",
        inviteUpdateErr,
        "Could not finalize invite usage.",
        { email, inviteId: invite.id }
      );
    }

    if (invite.request_id) {
      const { error: requestUpdateErr } = await supabaseServer
        .from("admin_access_requests")
        .update({
          status: "approved",
          updated_at: timestamp,
          reviewed_at: timestamp,
          reviewed_by_email: "invite-accepted",
        })
        .eq("id", invite.request_id);

      if (requestUpdateErr) {
        console.warn("admin request approval update after invite accept failed:", {
          inviteId: invite.id,
          requestId: invite.request_id,
          message: requestUpdateErr.message,
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return respondWithApiError(
      res,
      500,
      "admin-users-accept-invite",
      err,
      "Failed to accept invite."
    );
  }
}
