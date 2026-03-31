import { supabase } from "./supabaseClient";

async function parseJsonSafe(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

export async function getClientAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function fetchSiteFile(contentKey) {
  const resp = await fetch(
    `/api/site-files?contentKey=${encodeURIComponent(String(contentKey || ""))}`
  );
  const json = await parseJsonSafe(resp);

  if (!resp.ok) {
    throw new Error(json?.error || "Failed to load file attachment.");
  }

  return json?.file || null;
}

export async function saveSiteFile({
  contentKey,
  fileUrl,
  fileType,
  token,
}) {
  const accessToken = token || (await getClientAccessToken());
  if (!accessToken) {
    throw new Error("Please sign in again to save file attachments.");
  }

  const resp = await fetch("/api/site-files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contentKey,
      fileUrl,
      fileType,
    }),
  });

  const json = await parseJsonSafe(resp);
  if (!resp.ok) {
    throw new Error(json?.error || "Failed to save file attachment.");
  }

  return json?.file || null;
}

export async function deleteSiteFile(contentKey, token) {
  const accessToken = token || (await getClientAccessToken());
  if (!accessToken) {
    throw new Error("Please sign in again to remove file attachments.");
  }

  const resp = await fetch("/api/site-files", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ contentKey }),
  });

  const json = await parseJsonSafe(resp);
  if (!resp.ok) {
    throw new Error(json?.error || "Failed to remove file attachment.");
  }

  return true;
}
