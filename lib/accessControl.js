export const OWNER_ROLE = "owner";

function resolveConfiguredOwnerEmail() {
  return (
    process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ||
    process.env.SITE_OWNER_EMAIL ||
    "updaytesjournal@gmail.com"
  );
}

export const DEFAULT_OWNER_EMAIL = resolveConfiguredOwnerEmail();

export function getConfiguredOwnerEmail() {
  return DEFAULT_OWNER_EMAIL;
}

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
  const ownerEmail = normalizeEmail(getConfiguredOwnerEmail());

  if (normalizedEmail && normalizedEmail === ownerEmail) {
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
  if (!user?.id) {
    return null;
  }

  const ownerEmail = normalizeEmail(getConfiguredOwnerEmail());
  if (!ownerEmail || normalizeEmail(user.email) !== ownerEmail) {
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

  const configuredOwnerEmail = normalizeEmail(getConfiguredOwnerEmail());
  if (emails.length) {
    return emails;
  }

  return configuredOwnerEmail ? [configuredOwnerEmail] : [];
}
