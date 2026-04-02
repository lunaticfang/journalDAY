export default async function handler(req, res) {
  return res.status(410).json({
    error: "This legacy editor-check endpoint has been retired. Use /api/auth/access instead.",
  });
}
