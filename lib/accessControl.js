import { supabaseServer } from "./supabaseServer";

export const OWNER_ROLE = "owner";
export const DEFAULT_OWNER_EMAIL = "updaytesjournal@gmail.com";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isOwnerProfile(profile) {
  return !!profile && profile.approved === true && profile.role === OWNER_ROLE;
}

export function isApprovedProfileRole(profile, roles = []) {
  return (
    !!profile &&
    profile.approved === true &&
    (profile.role === OWNER_ROLE || roles.includes(profile.role))
  );
}

export async function getProfileByUserId(userId, client = supabaseServer) {
  if (!userId) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, email, role, approved")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getOwnerNotificationEmails(client = supabaseServer) {
  const { data, error } = await client
    .from("profiles")
    .select("email")
    .eq("role", OWNER_ROLE)
    .eq("approved", true);

  if (error) {
    throw error;
  }

  const emails = Array.from(
    new Set(
      (data || [])
        .map((row) => normalizeEmail(row.email))
        .filter(Boolean)
    )
  );

  return emails.length ? emails : [DEFAULT_OWNER_EMAIL];
}
