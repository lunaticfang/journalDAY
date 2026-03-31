import { supabase } from "./supabaseClient";
import { DEFAULT_OWNER_EMAIL, normalizeEmail } from "./accessControl";

async function fetchCurrentAccess(roles = []) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user || !session.access_token) {
    return {
      user: null,
      profile: null,
      isOwner: false,
      allowed: false,
    };
  }

  try {
    const query = roles.length
      ? `?roles=${encodeURIComponent(roles.join(","))}`
      : "";
    const resp = await fetch(`/api/auth/access${query}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(json?.error || "Failed to load access profile.");
    }

    return {
      user: json?.user || session.user,
      profile: json?.profile || null,
      isOwner: Boolean(json?.isOwner),
      allowed:
        typeof json?.allowed === "boolean" ? json.allowed : Boolean(session.user),
    };
  } catch (err) {
    console.error("Could not load current client access:", err);

    const ownerFallback =
      normalizeEmail(session.user.email) === normalizeEmail(DEFAULT_OWNER_EMAIL);

    return {
      user: session.user,
      profile: null,
      isOwner: ownerFallback,
      allowed: ownerFallback || roles.length === 0,
    };
  }
}

export async function getCurrentClientProfile() {
  const access = await fetchCurrentAccess();
  return {
    user: access.user,
    profile: access.profile,
    isOwner: access.isOwner,
  };
}

export async function getCurrentClientAccess(roles = []) {
  return fetchCurrentAccess(roles);
}
