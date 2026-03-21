import { getBootstrapStatus } from "../../../../lib/adminBootstrap";

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
    console.error("bootstrap status error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
