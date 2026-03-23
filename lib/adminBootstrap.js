import { supabaseServer } from "./supabaseServer";
import { DEFAULT_OWNER_EMAIL, OWNER_ROLE } from "./accessControl";

export function getBootstrapSecret() {
  return String(process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
}

export function getOwnerEmail() {
  return DEFAULT_OWNER_EMAIL;
}

export async function findAuthUserByEmail(email) {
  const { data, error } = await supabaseServer.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  return (data.users || []).find(
    (user) => String(user.email || "").toLowerCase() === email.toLowerCase()
  );
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
