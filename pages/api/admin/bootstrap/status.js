import { getBootstrapStatus } from "../../../../lib/adminBootstrap";
import { respondWithApiError } from "../../../../lib/apiError";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const status = await getBootstrapStatus();
    return res.status(200).json({
      ok: true,
      ...status,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-bootstrap-status",
      err,
      "Could not load bootstrap status."
    );
  }
}
