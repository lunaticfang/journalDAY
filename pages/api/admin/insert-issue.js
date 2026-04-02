export default async function handler(req, res) {
  return res.status(410).json({
    error: "This debug issue-insert endpoint has been retired.",
  });
}
