import crypto from "crypto";
import {
  findAuthUserByEmail,
  getBootstrapSecret,
  getBootstrapStatus,
  getOwnerEmail,
} from "../../../../lib/adminBootstrap";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { OWNER_ROLE } from "../../../../lib/accessControl";
import {
  normalizeEmail,
  validatePasswordStrength,
} from "../../../../lib/authSecurity";
import { respondWithApiError } from "../../../../lib/apiError";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function secretsMatch(providedSecret, expectedSecret) {
  const providedBuffer = Buffer.from(String(providedSecret || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expectedSecret || ""), "utf8");

  if (!providedBuffer.length || providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
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
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const passwordPolicyError = validatePasswordStrength(password);

    if (!secretsMatch(providedSecret, getBootstrapSecret())) {
      return res.status(403).json({ error: "Invalid bootstrap secret." });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }

    if (passwordPolicyError) {
      return res.status(400).json({ error: passwordPolicyError });
    }

    let user = await findAuthUserByEmail(email);

    if (user?.id) {
      const { data: updatedUser, error: updateErr } =
        await supabaseServer.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
        });

      if (updateErr) {
        return respondWithApiError(
          res,
          500,
          "admin-bootstrap-update-user",
          updateErr,
          "Could not update bootstrap account."
        );
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
        return respondWithApiError(
          res,
          500,
          "admin-bootstrap-create-user",
          createErr,
          "Could not create bootstrap account."
        );
      }

      user = createdUser.user;
    }

    if (!user?.id) {
      return respondWithApiError(
        res,
        500,
        "admin-bootstrap-resolve-user",
        new Error("Bootstrap user resolved without id."),
        "Could not resolve bootstrap account."
      );
    }

    const normalizedOwnerEmail = getOwnerEmail().toLowerCase();
    const assignedRole = email === normalizedOwnerEmail ? OWNER_ROLE : "admin";

    const { error: profileErr } = await supabaseServer.from("profiles").upsert(
      {
        id: user.id,
        email,
        role: assignedRole,
        approved: true,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      return respondWithApiError(
        res,
        500,
        "admin-bootstrap-upsert-profile",
        profileErr,
        "Could not create bootstrap profile."
      );
    }

    return res.status(200).json({
      ok: true,
      email,
      role: assignedRole,
      ownerEmail: getOwnerEmail(),
      isOwnerEmail: assignedRole === OWNER_ROLE,
    });
  } catch (err) {
    return respondWithApiError(
      res,
      500,
      "admin-bootstrap-create",
      err,
      "Failed to complete bootstrap setup."
    );
  }
}
