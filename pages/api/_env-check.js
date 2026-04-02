export default function handler(req, res) {
  return res.status(410).json({
    error: "This diagnostic endpoint has been retired.",
  });
}
