// pages/api/admin/upload-file.js
export default async function handler(req, res) {
  return res.status(410).json({
    error: "This legacy upload endpoint has been retired. Use the publish workflow instead.",
  });
}
