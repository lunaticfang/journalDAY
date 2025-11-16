// lib/roles.js
export const ROLES = {
  AUTHOR: "author",
  EDITOR: "editor",
  COPYEDITOR: "copyeditor",
  REVIEWER: "reviewer",
  MANAGER: "manager",
};

export function isAtLeastEditor(role) {
  if (!role) return false;
  return role === ROLES.EDITOR || role === ROLES.MANAGER;
}
