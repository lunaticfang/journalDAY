/*
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  approved_by: string | null;
  approved_at: string | null;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // --------------------------------------------------
  // 1. Auth + admin guard
  // --------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: me, error } = await supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", user.id)
        .single();

      if (error || !me?.is_admin) {
        router.replace("/");
        return;
      }

      if (mounted) {
        setCurrentUserId(user.id);
        await loadProfiles();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // --------------------------------------------------
  // 2. Load all users
  // --------------------------------------------------
  async function loadProfiles() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, is_admin, approved_by, approved_at")
        .order("email", { ascending: true });

      if (error) throw error;

      setProfiles(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // 3. Promote / demote admin
  // --------------------------------------------------
  async function updateAdminStatus(
    userId: string,
    makeAdmin: boolean
  ) {
    if (!currentUserId) return;

    try {
      setUpdatingId(userId);
      setErrorMsg(null);

      const updates = makeAdmin
        ? {
            is_admin: true,
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          }
        : {
            is_admin: false,
            approved_by: null,
            approved_at: null,
          };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      await loadProfiles();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update admin status");
    } finally {
      setUpdatingId(null);
    }
  }

  // --------------------------------------------------
  // 4. Render
  // --------------------------------------------------
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>
        Manage Administrators
      </h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
        Admins can promote or remove other admins. You cannot remove yourself.
      </p>

      {errorMsg && (
        <p style={{ color: "crimson", marginBottom: 12 }}>
          {errorMsg}
        </p>
      )}

      {loading ? (
        <p>Loading users…</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Approved By</th>
              <th style={thStyle}>Approved At</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const isSelf = p.id === currentUserId;
              const isUpdating = updatingId === p.id;

              return (
                <tr key={p.id}>
                  <td style={tdStyle}>{p.email}</td>
                  <td style={tdStyle}>
                    {p.is_admin ? "Admin" : "User"}
                  </td>
                  <td style={tdStyle}>{p.approved_by ?? "-"}</td>
                  <td style={tdStyle}>
                    {p.approved_at
                      ? new Date(p.approved_at).toLocaleString()
                      : "-"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {p.is_admin ? (
                      <button
                        disabled={isSelf || isUpdating}
                        onClick={() => updateAdminStatus(p.id, false)}
                        style={dangerBtn(isSelf || isUpdating)}
                        title={
                          isSelf
                            ? "You cannot remove yourself"
                            : "Remove admin access"
                        }
                      >
                        Remove Admin
                      </button>
                    ) : (
                      <button
                        disabled={isUpdating}
                        onClick={() => updateAdminStatus(p.id, true)}
                        style={primaryBtn(isUpdating)}
                      >
                        Make Admin
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

// --------------------------------------------------
// Styles
// --------------------------------------------------
const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: 8,
  textAlign: "left",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: 8,
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: disabled ? "#9ca3af" : "#6A3291",
  color: "white",
  cursor: disabled ? "default" : "pointer",
  fontSize: 13,
});

const dangerBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: disabled ? "#9ca3af" : "#dc2626",
  color: "white",
  cursor: disabled ? "default" : "pointer",
  fontSize: 13,
});
*/

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "author";
  approved: boolean;
};

const SUPER_ADMIN_EMAIL = "admin@updaytes.org"; // bootstrap admin

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string>("");

  /* ------------------------------------------------------------ */
  /* Auth + permission guard                                      */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      setCurrentUserEmail(user.email ?? null);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, approved")
        .eq("id", user.id)
        .maybeSingle();

      if (
        error ||
        !profile ||
        profile.role !== "admin" ||
        profile.approved !== true
      ) {
        router.replace("/");
        return;
      }

      if (mounted) {
        await loadUsers();
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* ------------------------------------------------------------ */
  /* Load all users                                               */
  /* ------------------------------------------------------------ */
  async function loadUsers() {
    setError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, approved")
      .order("email", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setUsers((data || []) as UserRow[]);
  }

  /* ------------------------------------------------------------ */
  /* Actions                                                      */
  /* ------------------------------------------------------------ */
  async function approveAdmin(userId: string) {
    await supabase
      .from("profiles")
      .update({ role: "admin", approved: true })
      .eq("id", userId);

    loadUsers();
  }

  async function revokeAdmin(userId: string) {
    await supabase
      .from("profiles")
      .update({ role: "author", approved: false })
      .eq("id", userId);

    loadUsers();
  }

  /* ------------------------------------------------------------ */
  /* Render                                                       */
  /* ------------------------------------------------------------ */
  if (loading) {
    return <p>Loading admin users…</p>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Admin Management
      </h1>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Approved admins can approve other admins. The super admin cannot be
        removed.
      </p>

      {error && (
        <p style={{ color: "crimson", marginBottom: 12 }}>
          Error: {error}
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Approved</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => {
            const isSuperAdmin = u.email === SUPER_ADMIN_EMAIL;
            const isCurrentSuperAdmin =
              currentUserEmail === SUPER_ADMIN_EMAIL;

            return (
              <tr key={u.id}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.role}</td>
                <td style={td}>{u.approved ? "Yes" : "No"}</td>
                <td style={td}>
                  {u.role === "author" && (
                    <button
                      onClick={() => approveAdmin(u.id)}
                      style={btn}
                    >
                      Approve as Admin
                    </button>
                  )}

                  {u.role === "admin" && !isSuperAdmin && isCurrentSuperAdmin && (
                    <button
                      onClick={() => revokeAdmin(u.id)}
                      style={{ ...btn, background: "#fee2e2" }}
                    >
                      Revoke Admin
                    </button>
                  )}

                  {isSuperAdmin && (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      Super Admin
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

/* ------------------------------------------------------------ */
/* Styles                                                       */
/* ------------------------------------------------------------ */
const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: 8,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: 8,
};

const btn: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid #d1d5db",
  background: "#e5e7eb",
  cursor: "pointer",
  fontSize: 12,
};
