import { supabaseServer } from "../../../lib/supabaseServer";
import { sendSubmissionReceiptEmail } from "../../../lib/submissionReceipt";
import { respondWithApiError } from "../../../lib/apiError";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
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
      .select("id, title, authors, author_id, submitter_id, created_at, status")
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

    const receipt = await sendSubmissionReceiptEmail({
      manuscript,
      userEmail: userData.user.email ?? null,
      req,
    });

    return res.status(200).json({
      ok: true,
      receipt,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "submission-notify",
      err,
      "Failed to send submission receipt."
    );
  }
}
