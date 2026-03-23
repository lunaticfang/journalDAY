import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { requireRole } from "../../../../lib/adminAuth";
import { normalizeAdminAccessRequestRow } from "../../../../lib/adminAccessRequests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireRole(req, res, ["admin"]);
    if (!auth) return;

    const { data: requests, error: requestError } = await supabaseServer
      .from("admin_access_requests")
      .select(
        "id, name, email, message, status, created_at, updated_at, reviewed_at, reviewed_by_email"
      )
      .order("created_at", { ascending: false });

    if (requestError) {
      throw requestError;
    }

    const { data: privilegedProfiles, error: profileError } = await supabaseServer
      .from("profiles")
      .select("email")
      .in("role", ["owner", "admin"])
      .eq("approved", true);

    if (profileError) {
      throw profileError;
    }

    const approvedEmails = new Set(
      (privilegedProfiles || [])
        .map((row: { email?: string | null }) => String(row.email || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const normalizedRequests = (requests || [])
      .map((row) => normalizeAdminAccessRequestRow(row))
      .filter(Boolean);

    const reconciledRequests = await Promise.all(
      normalizedRequests.map(async (request: any) => {
        if (request.status === "approved" || !approvedEmails.has(request.email)) {
          return request;
        }

        const timestamp = new Date().toISOString();
        const updatedRequest = {
          ...request,
          status: "approved",
          updated_at: timestamp,
          reviewed_at: request.reviewed_at || timestamp,
          reviewed_by_email: request.reviewed_by_email || "system",
        };

        const { error: updateError } = await supabaseServer
          .from("admin_access_requests")
          .update({
            status: "approved",
            updated_at: timestamp,
            reviewed_at: updatedRequest.reviewed_at,
            reviewed_by_email: updatedRequest.reviewed_by_email,
          })
          .eq("id", request.id);

        if (updateError) {
          throw updateError;
        }

        return updatedRequest;
      })
    );

    return res.status(200).json({
      ok: true,
      requests: reconciledRequests,
      actor: {
        id: auth.user.id,
        email: auth.user.email ?? auth.profile?.email ?? null,
      },
    });
  } catch (err: any) {
    console.error("admin requests list error:", err);
    return res.status(500).json({ error: err?.message || "Failed to load requests" });
  }
}
