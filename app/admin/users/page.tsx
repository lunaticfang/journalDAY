"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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
  errorId?: string;
};

type AdminAccessRequest = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: "pending" | "invited" | "approved" | "rejected";
  created_at: string | null;
  updated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_email?: string | null;
};

type RequestsResponse = {
  requests?: AdminAccessRequest[];
  error?: string;
  errorId?: string;
};

type RequestFilter =
  | "action_needed"
  | "all"
  | "pending"
  | "invited"
  | "approved"
  | "rejected";

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("action_needed");
  const [showResolvedInAll, setShowResolvedInAll] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [actorIsOwner, setActorIsOwner] = useState(false);

  const appendErrorReference = (
    message: string,
    errorId: string | null | undefined
  ) => {
    const normalizedMessage = String(message || "").trim();
    const normalizedErrorId = String(errorId || "").trim();
    if (!normalizedErrorId) {
      return normalizedMessage;
    }
    return `${normalizedMessage} Reference: ${normalizedErrorId}.`;
  };

  const loadUsers = async (
    activeToken: string,
    fallbackId?: string | null,
    fallbackEmail?: string | null
  ) => {
    const resp = await fetch("/api/admin/users/list", {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    const json = (await resp.json().catch(() => ({}))) as ListResponse;

    if (resp.status === 401) {
      router.replace("/admin/login");
      return false;
    }

    if (resp.status === 403) {
      router.replace("/");
      return false;
    }

    if (!resp.ok) {
      setError(
        appendErrorReference(json?.error || "Failed to load users.", json?.errorId)
      );
      return false;
    }

    setUsers(json.users || []);
    setCurrentUserId(json.actor?.id ?? fallbackId ?? null);
    setCurrentUserEmail(json.actor?.email ?? fallbackEmail ?? null);
    setActorIsOwner(Boolean(json.actor?.isOwner));
    return true;
  };

  const loadRequests = async (activeToken: string) => {
    const resp = await fetch("/api/admin/requests/list", {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    const json = (await resp.json().catch(() => ({}))) as RequestsResponse;

    if (resp.status === 401) {
      router.replace("/admin/login");
      return false;
    }

    if (resp.status === 403) {
      router.replace("/");
      return false;
    }

    if (!resp.ok) {
      setError(
        appendErrorReference(
          json?.error || "Failed to load admin access requests.",
          json?.errorId
        )
      );
      return false;
    }

    setRequests(json.requests || []);
    return true;
  };

  const refreshAdminData = async (
    activeToken: string,
    fallbackId?: string | null,
    fallbackEmail?: string | null
  ) => {
    setError("");
    const [usersOk, requestsOk] = await Promise.all([
      loadUsers(activeToken, fallbackId, fallbackEmail),
      loadRequests(activeToken),
    ]);
    return usersOk && requestsOk;
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
      await refreshAdminData(accessToken, user.id, user.email ?? null);
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const postInvite = async (email: string, requestId?: string | null) => {
    if (!token) {
      setError("Please sign in again.");
      return null;
    }

    const resp = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        requestId: requestId || null,
      }),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      error?: string;
      already_admin?: boolean;
      errorId?: string;
    };

    if (resp.status === 401) {
      router.replace("/admin/login");
      return null;
    }

    if (resp.status === 403) {
      router.replace("/");
      return null;
    }

    if (!resp.ok) {
      throw new Error(
        appendErrorReference(json?.error || "Failed to send invite.", json?.errorId)
      );
    }

    return {
      alreadyAdmin: Boolean(json.already_admin),
    };
  };

  const updateRequestStatus = async (
    id: string,
    status: AdminAccessRequest["status"]
  ) => {
    if (!token) {
      setError("Please sign in again.");
      return false;
    }

    const resp = await fetch("/api/admin/requests/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, status }),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      error?: string;
      errorId?: string;
    };

    if (resp.status === 401) {
      router.replace("/admin/login");
      return false;
    }

    if (resp.status === 403) {
      router.replace("/");
      return false;
    }

    if (!resp.ok) {
      throw new Error(
        appendErrorReference(
          json?.error || "Failed to update request.",
          json?.errorId
        )
      );
    }

    return true;
  };

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

      const json = (await resp.json().catch(() => ({}))) as {
        error?: string;
        errorId?: string;
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
        setError(
          appendErrorReference(json.error || "Action failed.", json?.errorId)
        );
        return;
      }

      await refreshAdminData(token, currentUserId, currentUserEmail);
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
    setRequestStatus("");
    setError("");

    try {
      const inviteResult = await postInvite(email);
      if (!inviteResult) {
        return;
      }

      if (inviteResult.alreadyAdmin) {
        setInviteStatus("This user is already an approved admin.");
      } else {
        setInviteStatus(
          "Invite sent. They must approve it from email before receiving the password setup mail."
        );
      }

      setInviteEmail("");
      await refreshAdminData(token, currentUserId, currentUserEmail);
    } catch (err: any) {
      setError(err?.message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleInviteRequest = async (request: AdminAccessRequest) => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }

    setRequestBusyId(request.id);
    setInviteStatus("");
    setRequestStatus("");
    setError("");

    try {
      const inviteResult = await postInvite(request.email, request.id);
      if (!inviteResult) {
        return;
      }

      const nextStatus: AdminAccessRequest["status"] = inviteResult.alreadyAdmin
        ? "approved"
        : "invited";

      const updated = await updateRequestStatus(request.id, nextStatus);
      if (!updated) {
        return;
      }

      setRequestStatus(
        inviteResult.alreadyAdmin
          ? `${request.email} is already an approved admin. The request was marked approved.`
          : `Invite sent to ${request.email}. The request was marked invited.`
      );

      await refreshAdminData(token, currentUserId, currentUserEmail);
    } catch (err: any) {
      setError(err?.message || "Failed to process admin request.");
    } finally {
      setRequestBusyId(null);
    }
  };

  const handleRequestStatusChange = async (
    request: AdminAccessRequest,
    status: AdminAccessRequest["status"]
  ) => {
    if (!token) {
      setError("Please sign in again.");
      return;
    }

    setRequestBusyId(request.id);
    setInviteStatus("");
    setRequestStatus("");
    setError("");

    try {
      const updated = await updateRequestStatus(request.id, status);
      if (!updated) {
        return;
      }

      setRequestStatus(
        status === "pending"
          ? `Request from ${request.email} moved back to pending.`
          : `Request from ${request.email} marked ${status}.`
      );

      await loadRequests(token);
    } catch (err: any) {
      setError(err?.message || "Failed to update admin request.");
    } finally {
      setRequestBusyId(null);
    }
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading admin users...</p>;
  }

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const invitedCount = requests.filter((request) => request.status === "invited").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;
  const rejectedCount = requests.filter((request) => request.status === "rejected").length;
  const actionNeededRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "invited"
  );
  const resolvedRequests = requests.filter(
    (request) => request.status === "approved" || request.status === "rejected"
  );

  let visibleRequests: AdminAccessRequest[] = [];
  if (requestFilter === "all" || requestFilter === "action_needed") {
    visibleRequests = actionNeededRequests;
  } else if (requestFilter === "pending") {
    visibleRequests = requests.filter((request) => request.status === "pending");
  } else if (requestFilter === "invited") {
    visibleRequests = requests.filter((request) => request.status === "invited");
  } else if (requestFilter === "approved") {
    visibleRequests = requests.filter((request) => request.status === "approved");
  } else {
    visibleRequests = requests.filter((request) => request.status === "rejected");
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
        Signed in as: <strong>{currentUserEmail || "Unknown user"}</strong>
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
          <p style={{ marginTop: 8, fontSize: 12, color: "#065f46" }}>
            {inviteStatus}
          </p>
        )}
      </div>

      <div
        style={{
          marginBottom: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "white",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Admin Access Requests
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Requests submitted from the public admin access form show up here for review.
            </p>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: pendingCount > 0 ? "#6A3291" : "#6b7280",
              background: pendingCount > 0 ? "#f3e8ff" : "#f3f4f6",
              borderRadius: 999,
              padding: "6px 10px",
            }}
          >
            {pendingCount} pending
          </span>
        </div>

        {requestStatus && (
          <p style={{ marginTop: 0, marginBottom: 10, fontSize: 12, color: "#065f46" }}>
            {requestStatus}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setRequestFilter("action_needed")}
            style={{
              ...filterBtn,
              ...(requestFilter === "action_needed" ? filterBtnActive : null),
            }}
          >
            Action Needed ({actionNeededRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilter("all")}
            style={{
              ...filterBtn,
              ...(requestFilter === "all" ? filterBtnActive : null),
            }}
          >
            All ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilter("pending")}
            style={{
              ...filterBtn,
              ...(requestFilter === "pending" ? filterBtnActive : null),
            }}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilter("invited")}
            style={{
              ...filterBtn,
              ...(requestFilter === "invited" ? filterBtnActive : null),
            }}
          >
            Invited ({invitedCount})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilter("approved")}
            style={{
              ...filterBtn,
              ...(requestFilter === "approved" ? filterBtnActive : null),
            }}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilter("rejected")}
            style={{
              ...filterBtn,
              ...(requestFilter === "rejected" ? filterBtnActive : null),
            }}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {requests.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            No admin access requests have been submitted yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleRequests.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #d1d5db",
                  borderRadius: 8,
                  padding: 14,
                  color: "#6b7280",
                  fontSize: 13,
                  background: "#fcfcfd",
                }}
              >
                {requestFilter === "action_needed"
                  ? "No requests need attention right now. You can switch to All or one of the resolved filters to review older requests."
                  : requestFilter === "all"
                    ? "No action-needed requests are currently visible."
                    : `No ${requestFilter.replace("_", " ")} requests found.`}
              </div>
            ) : null}

            {visibleRequests.map((request) => {
              const isBusy = requestBusyId === request.id;
              const createdAt = request.created_at
                ? new Date(request.created_at).toLocaleString()
                : "Unknown time";
              const reviewedMeta =
                request.reviewed_at && request.reviewed_by_email
                  ? `Updated ${new Date(request.reviewed_at).toLocaleString()} by ${request.reviewed_by_email}`
                  : request.reviewed_at
                    ? `Updated ${new Date(request.reviewed_at).toLocaleString()}`
                    : null;

              return (
                <div
                  key={request.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 12,
                    background: request.status === "pending" ? "#fcfbff" : "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                        {request.name}
                      </div>
                      <div style={{ fontSize: 13, color: "#4b5563", marginTop: 2 }}>
                        {request.email}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        Submitted {createdAt}
                      </div>
                    </div>

                    <span
                      style={{
                        ...statusPill,
                        ...(request.status === "pending"
                          ? statusPending
                          : request.status === "invited"
                            ? statusInvited
                            : request.status === "approved"
                              ? statusApproved
                              : statusRejected),
                      }}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 6,
                      background: "#f9fafb",
                      color: "#111827",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {request.message}
                  </div>

                  {reviewedMeta && (
                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#6b7280" }}>
                      {reviewedMeta}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleInviteRequest(request);
                      }}
                      disabled={isBusy}
                      style={{
                        ...btn,
                        background: "#6A3291",
                        border: "1px solid #6A3291",
                        color: "white",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy
                        ? "Working..."
                        : request.status === "invited"
                          ? "Resend Invite"
                          : "Invite Admin"}
                    </button>

                    {request.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleRequestStatusChange(request, "approved");
                        }}
                        disabled={isBusy}
                        style={{
                          ...btn,
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          color: "#065f46",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        Mark Approved
                      </button>
                    )}

                    {request.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleRequestStatusChange(request, "rejected");
                        }}
                        disabled={isBusy}
                        style={{
                          ...btn,
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          color: "#be123c",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        Reject
                      </button>
                    )}

                    {request.status !== "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleRequestStatusChange(request, "pending");
                        }}
                        disabled={isBusy}
                        style={{
                          ...btn,
                          background: "#f3f4f6",
                          border: "1px solid #d1d5db",
                          color: "#374151",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        Move Back To Pending
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {requestFilter === "all" && resolvedRequests.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginTop: 4,
                  paddingTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowResolvedInAll((prev) => !prev)}
                  style={{
                    ...filterBtn,
                    width: "100%",
                    justifyContent: "center",
                    background: "#f9fafb",
                    borderColor: "#e5e7eb",
                    color: "#374151",
                  }}
                >
                  {showResolvedInAll
                    ? `Hide Resolved Requests (${resolvedRequests.length})`
                    : `Show Resolved Requests (${resolvedRequests.length})`}
                </button>

                {showResolvedInAll && (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {resolvedRequests.map((request) => {
                      const isBusy = requestBusyId === request.id;
                      const createdAt = request.created_at
                        ? new Date(request.created_at).toLocaleString()
                        : "Unknown time";
                      const reviewedMeta =
                        request.reviewed_at && request.reviewed_by_email
                          ? `Updated ${new Date(request.reviewed_at).toLocaleString()} by ${request.reviewed_by_email}`
                          : request.reviewed_at
                            ? `Updated ${new Date(request.reviewed_at).toLocaleString()}`
                            : null;

                      return (
                        <div
                          key={request.id}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: 12,
                            background: "#fafafa",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                                {request.name}
                              </div>
                              <div style={{ fontSize: 13, color: "#4b5563", marginTop: 2 }}>
                                {request.email}
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                                Submitted {createdAt}
                              </div>
                            </div>

                            <span
                              style={{
                                ...statusPill,
                                ...(request.status === "approved" ? statusApproved : statusRejected),
                              }}
                            >
                              {request.status}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              padding: 10,
                              borderRadius: 6,
                              background: "#f9fafb",
                              color: "#111827",
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {request.message}
                          </div>

                          {reviewedMeta && (
                            <p
                              style={{
                                marginTop: 8,
                                marginBottom: 0,
                                fontSize: 12,
                                color: "#6b7280",
                              }}
                            >
                              {reviewedMeta}
                            </p>
                          )}

                          <div
                            style={{
                              marginTop: 12,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                void handleInviteRequest(request);
                              }}
                              disabled={isBusy}
                              style={{
                                ...btn,
                                background: "#6A3291",
                                border: "1px solid #6A3291",
                                color: "white",
                                cursor: isBusy ? "not-allowed" : "pointer",
                                opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              {isBusy ? "Working..." : "Invite Again"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                void handleRequestStatusChange(request, "pending");
                              }}
                              disabled={isBusy}
                              style={{
                                ...btn,
                                background: "#f3f4f6",
                                border: "1px solid #d1d5db",
                                color: "#374151",
                                cursor: isBusy ? "not-allowed" : "pointer",
                                opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              Move Back To Pending
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
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
            const isOwnerUser = u.role === "owner" && u.approved === true;
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

const filterBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const filterBtnActive: React.CSSProperties = {
  background: "#f3e8ff",
  borderColor: "#d8b4fe",
  color: "#6A3291",
};

const statusPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "capitalize",
};

const statusPending: React.CSSProperties = {
  background: "#f3e8ff",
  color: "#6A3291",
};

const statusInvited: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
};

const statusApproved: React.CSSProperties = {
  background: "#ecfdf5",
  color: "#047857",
};

const statusRejected: React.CSSProperties = {
  background: "#fff1f2",
  color: "#be123c",
};
