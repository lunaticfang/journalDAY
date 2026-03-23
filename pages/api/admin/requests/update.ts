import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import {
  normalizeAdminAccessRequestRow,
  normalizeAdminAccessRequestStatus,
} from "../../../../lib/adminAccessRequests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res, ["admin"]);
    if (!auth) return;

    const id = String(req.body?.id || "").trim();
    const status = normalizeAdminAccessRequestStatus(req.body?.status);

    if (!id) {
      return res.status(400).json({ error: "Missing request id" });
    }

    const { data: row, error: rowError } = await supabaseServer
      .from("admin_access_requests")
      .select(
        "id, name, email, message, status, created_at, updated_at, reviewed_at, reviewed_by_email"
      )
      .eq("id", id)
      .maybeSingle();

    if (rowError) {
      throw rowError;
    }

    const requestRecord = normalizeAdminAccessRequestRow(row);
    if (!requestRecord) {
      return res.status(404).json({ error: "Admin request not found" });
    }

    const reviewedEmail = auth.user.email ?? auth.profile?.email ?? null;
    const timestamp = new Date().toISOString();

    const { error: updateError } = await supabaseServer
      .from("admin_access_requests")
      .update({
        status,
        updated_at: timestamp,
        reviewed_at: status === "pending" ? null : timestamp,
        reviewed_by: status === "pending" ? null : auth.user.id,
        reviewed_by_email: status === "pending" ? null : reviewedEmail,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    if (status !== "invited") {
      const { data: pendingInvites, error: inviteError } = await supabaseServer
        .from("admin_invites")
        .select("id")
        .eq("request_id", id)
        .eq("status", "pending");

      if (inviteError) {
        throw inviteError;
      }

      if ((pendingInvites || []).length > 0) {
        const { error: revokeError } = await supabaseServer
          .from("admin_invites")
          .update({
            status: "revoked",
            revoked_at: timestamp,
            revoked_by: auth.user.id,
            revoked_by_email: reviewedEmail,
          })
          .in("id", (pendingInvites || []).map((invite) => invite.id));

        if (revokeError) {
          throw revokeError;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      request: {
        ...requestRecord,
        status,
        updated_at: timestamp,
        reviewed_at: status === "pending" ? null : timestamp,
        reviewed_by_email: status === "pending" ? null : reviewedEmail,
      },
    });
  } catch (err: any) {
    console.error("admin request update error:", err);
    return res.status(500).json({ error: err?.message || "Failed to update request" });
  }
}
