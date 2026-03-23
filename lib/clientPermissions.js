import { supabase } from "./supabaseClient";
import { isApprovedProfileRole, isOwnerProfile } from "./accessControl";

export async function getCurrentClientProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return {
      user: null,
      profile: null,
      isOwner: false,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, approved")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not load current client profile:", profileError);
  }

  return {
    user: authData.user,
    profile: profile || null,
    isOwner: isOwnerProfile(profile || null),
  };
}

export async function getCurrentClientAccess(roles = []) {
  const context = await getCurrentClientProfile();

  return {
    ...context,
    allowed: isApprovedProfileRole(context.profile, roles),
  };
}
