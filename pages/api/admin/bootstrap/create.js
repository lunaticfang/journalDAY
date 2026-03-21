import {
  findAuthUserByEmail,
  getBootstrapSecret,
  getBootstrapStatus,
  getOwnerEmail,
} from "../../../../lib/adminBootstrap";
import { supabaseServer } from "../../../../lib/supabaseServer";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const status = await getBootstrapStatus();
    if (!status.enabled) {
      return res.status(403).json({
        error: "Bootstrap setup is disabled.",
        reason: status.reason,
      });
    }

    const providedSecret = String(req.body?.secret || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (providedSecret !== getBootstrapSecret()) {
      return res.status(403).json({ error: "Invalid bootstrap secret." });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }

    if (!password || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    let user = await findAuthUserByEmail(email);

    if (user?.id) {
      const { data: updatedUser, error: updateErr } =
        await supabaseServer.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
        });

      if (updateErr) {
        return res
          .status(500)
          .json({ error: updateErr.message || "Could not update user." });
      }

      user = updatedUser.user;
    } else {
      const { data: createdUser, error: createErr } =
        await supabaseServer.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createErr) {
        return res
          .status(500)
          .json({ error: createErr.message || "Could not create user." });
      }

      user = createdUser.user;
    }

    if (!user?.id) {
      return res.status(500).json({ error: "Could not resolve user id." });
    }

    const { error: profileErr } = await supabaseServer.from("profiles").upsert(
      {
        id: user.id,
        email,
        role: "admin",
        approved: true,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      return res
        .status(500)
        .json({ error: profileErr.message || "Could not create admin profile." });
    }

    return res.status(200).json({
      ok: true,
      email,
      role: "admin",
      ownerEmail: getOwnerEmail(),
      isOwnerEmail: email === getOwnerEmail().toLowerCase(),
    });
  } catch (err) {
    console.error("bootstrap create error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
