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

export async function ensureProfileForUser(user, client) {
  if (!user?.id) return null;

  const activeClient = await resolveAccessControlClient(client);
  const normalizedEmail = normalizeEmail(user.email);

  if (normalizedEmail === normalizeEmail(DEFAULT_OWNER_EMAIL)) {
    const ownerProfile = {
      id: user.id,
      email: normalizedEmail,
      role: OWNER_ROLE,
      approved: true,
    };

    const { error } = await activeClient.from("profiles").upsert(ownerProfile, {
      onConflict: "id",
    });

    if (error) {
      throw error;
    }

    return ownerProfile;
  }

  const existingProfile = await getProfileByUserId(user.id, activeClient);
  if (existingProfile) {
    if (normalizedEmail && normalizeEmail(existingProfile.email) !== normalizedEmail) {
      const { data, error } = await activeClient
        .from("profiles")
        .update({ email: normalizedEmail })
        .eq("id", user.id)
        .select("id, email, role, approved")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data || existingProfile;
    }

    return existingProfile;
  }

  const authorProfile = {
    id: user.id,
    email: normalizedEmail || null,
    role: "author",
    approved: false,
  };

  const { error } = await activeClient.from("profiles").upsert(authorProfile, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }

  return authorProfile;
}

export async function ensureOwnerProfile(user, client) {
  if (!user?.id || normalizeEmail(user.email) !== normalizeEmail(DEFAULT_OWNER_EMAIL)) {
    return null;
  }

  return ensureProfileForUser(user, client);
}

async function resolveAccessControlClient(client) {
  if (client) {
    return client;
  }

  const { supabaseServer } = await import("./supabaseServer");
  return supabaseServer;
}

export async function getProfileByUserId(userId, client) {
  if (!userId) return null;

  const activeClient = await resolveAccessControlClient(client);

  const { data, error } = await activeClient
    .from("profiles")
    .select("id, email, role, approved")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getOwnerNotificationEmails(client) {
  const activeClient = await resolveAccessControlClient(client);

  const { data, error } = await activeClient
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
