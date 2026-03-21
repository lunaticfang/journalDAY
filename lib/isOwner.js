export const OWNER_EMAIL = "updaytesjournal@gmail.com";

export function isOwner(user) {
  return user?.email === OWNER_EMAIL;
}
