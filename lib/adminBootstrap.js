import { supabaseServer } from "./supabaseServer";
import { DEFAULT_OWNER_EMAIL, OWNER_ROLE } from "./accessControl";

export function getBootstrapSecret() {
  return String(process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
}

export function getOwnerEmail() {
  return DEFAULT_OWNER_EMAIL;
}

export async function findAuthUserByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const perPage = 1000;
  const maxPages = 100;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const found = users.find(
      (user) => String(user.email || "").toLowerCase() === normalizedEmail
    );

    if (found) {
      return found;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function getBootstrapStatus() {
  const secret = getBootstrapSecret();
  const ownerEmail = getOwnerEmail();

  if (!secret) {
    return {
      enabled: false,
      reason: "missing_secret",
      ownerEmail,
    };
  }

  const { data: ownerProfiles, error: ownerErr } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("role", OWNER_ROLE)
    .eq("approved", true)
    .limit(1);

  if (ownerErr) {
    throw ownerErr;
  }

  if ((ownerProfiles || []).length > 0) {
    return {
      enabled: false,
      reason: "owner_exists",
      ownerEmail,
    };
  }

  const { data: adminProfiles, error: adminErr } = await supabaseServer
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .eq("approved", true)
    .limit(1);

  if (adminErr) {
    throw adminErr;
  }

  if ((adminProfiles || []).length > 0) {
    return {
      enabled: false,
      reason: "admin_exists",
      ownerEmail,
    };
  }

  return {
    enabled: true,
    reason: "bootstrap_available",
    ownerEmail,
  };
}
