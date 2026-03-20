"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const OWNER_EMAIL = "updaytesjournal@gmail.com";

type UserRow = {
  id: string;
  email: string | null;
  role: string;
  approved: boolean | null;
};

type ListResponse = {
  users?: UserRow[];
  actor?: {
    id: string;
    email: string | null;
    isOwner: boolean;
  };
  error?: string;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [actorIsOwner, setActorIsOwner] = useState(false);

  const loadUsers = async (
    activeToken: string,
    fallbackId?: string | null,
    fallbackEmail?: string | null
  ) => {
    setError("");

    const resp = await fetch("/api/admin/users/list", {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    const json = (await resp.json().catch(() => ({}))) as ListResponse;

    if (resp.status === 401) {
      router.replace("/admin/login");
      return;
    }

    if (resp.status === 403) {
      router.replace("/");
      return;
    }

    if (!resp.ok) {
      setError(json?.error || "Failed to load users.");
      return;
    }

    setUsers(json.users || []);
    setCurrentUserId(json.actor?.id ?? fallbackId ?? null);
    setCurrentUserEmail(json.actor?.email ?? fallbackEmail ?? null);
    setActorIsOwner(Boolean(json.actor?.isOwner));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const user = session?.user;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const accessToken = session.access_token ?? null;
      if (!accessToken) {
        router.replace("/admin/login");
        return;
      }

      if (cancelled) return;

      setToken(accessToken);
      await loadUsers(accessToken, user.id, user.email ?? null);
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const runAction = async (action: "promote" | "demote", userId: string) => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }

    setBusyId(userId);
    setError("");

    try {
      const resp = await fetch(`/api/admin/users/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const json = (await resp.json().catch(() => ({}))) as { error?: string };

      if (resp.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (resp.status === 403) {
        router.replace("/");
        return;
      }

      if (!resp.ok) {
        setError(json.error || "Action failed.");
        return;
      }

      await loadUsers(token, currentUserId, currentUserEmail);
    } finally {
      setBusyId(null);
    }
  };

  const sendInvite = async () => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setError("Enter an email to invite.");
      return;
    }

    setInviting(true);
    setInviteStatus("");
    setError("");

    try {
      const resp = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const json = (await resp.json().catch(() => ({}))) as {
        error?: string;
        already_admin?: boolean;
      };

      if (resp.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (resp.status === 403) {
        router.replace("/");
        return;
      }

      if (!resp.ok) {
        setError(json?.error || "Failed to send invite.");
        return;
      }

      if (json.already_admin) {
        setInviteStatus("This user is already an approved admin.");
      } else {
        setInviteStatus(
          "Invite sent. They must approve it from email before receiving the password setup mail."
        );
      }
      setInviteEmail("");
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading admin users...</p>;
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Admin Management
      </h1>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Admin status can be sanctioned by the owner or any existing approved admin.
      </p>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Signed in as:{" "}
        <strong>{currentUserEmail || "Unknown user"}</strong>
        {actorIsOwner ? " (Owner)" : " (Admin)"}
      </p>

      <div
        style={{
          marginBottom: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#f8f7fb",
          padding: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Invite New Admin
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="admin@email.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendInvite();
              }
            }}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
            }}
          />
          <button
            type="button"
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              ...btn,
              background: "#6A3291",
              border: "1px solid #6A3291",
              color: "white",
              cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer",
              opacity: inviting || !inviteEmail.trim() ? 0.6 : 1,
            }}
          >
            {inviting ? "Sending..." : "Send Invite"}
          </button>
        </div>

        {inviteStatus && (
          <p style={{ marginTop: 8, fontSize: 12, color: "#065f46" }}>{inviteStatus}</p>
        )}
      </div>

      {error && (
        <p style={{ marginBottom: 12, color: "crimson", fontSize: 13 }}>
          {error}
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Approved</th>
            <th style={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const email = u.email || "(no email)";
            const isOwnerUser =
              typeof u.email === "string" &&
              u.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
            const isSelf = u.id === currentUserId;
            const isBusy = busyId === u.id;
            const isAdmin = u.role === "admin" && u.approved === true;

            return (
              <tr key={u.id}>
                <td style={td}>{email}</td>
                <td style={td}>{u.role}</td>
                <td style={td}>{u.approved ? "Yes" : "No"}</td>
                <td style={td}>
                  {isOwnerUser ? (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      Owner (protected)
                    </span>
                  ) : isAdmin ? (
                    <button
                      type="button"
                      onClick={() => runAction("demote", u.id)}
                      disabled={isBusy || isSelf}
                      style={{
                        ...btn,
                        background: "#fee2e2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        cursor: isBusy || isSelf ? "not-allowed" : "pointer",
                        opacity: isBusy || isSelf ? 0.6 : 1,
                      }}
                      title={isSelf ? "You cannot revoke yourself" : "Revoke admin"}
                    >
                      {isBusy ? "Working..." : "Revoke Admin"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAction("promote", u.id)}
                      disabled={isBusy}
                      style={{
                        ...btn,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "Working..." : "Approve as Admin"}
                    </button>
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

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: 8,
  fontWeight: 600,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: 8,
};

const btn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#eef2ff",
  color: "#312e81",
  fontSize: 12,
};
