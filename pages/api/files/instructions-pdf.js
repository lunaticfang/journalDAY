import path from "path";
import fs from "fs";

export default function handler(req, res) {
  const filePath = "/mnt/data/UpDAYtes_Author or Contributors Guidelines (1).pdf";

  const file = fs.readFileSync(filePath);
  res.setHeader("Content-Type", "application/pdf");
  res.send(file);
}
