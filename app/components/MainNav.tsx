/*
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ---------------- styles ---------------- //

const navItemStyle: React.CSSProperties = {
  position: "relative",
  padding: "8px 10px",
  cursor: "pointer",
  color: "#374151",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  minWidth: 220,
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  padding: "6px 0",
  display: "none",
  zIndex: 50,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 14px",
  fontSize: 13,
  color: "#111827",
  textDecoration: "none",
};

// ---------------- dropdown ---------------- //

function Dropdown({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div
      style={navItemStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget.querySelector(".dropdown") as HTMLElement;
        if (el) el.style.display = "block";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.querySelector(".dropdown") as HTMLElement;
        if (el) el.style.display = "none";
      }}
    >
      {label}
      <div className="dropdown" style={dropdownStyle}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={dropdownItemStyle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#f3f4f6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------- main nav ---------------- //

export default function MainNav() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;

      setUser(sessionUser);

      setIsAdmin(
        sessionUser?.user_metadata?.is_admin === true ||
        sessionUser?.app_metadata?.role === "admin"
      );
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Dropdown
        label="Home"
        items={[
          { label: "About the Journal", href: "/about" },
          { label: "Aim and Scope", href: "/aim-scope" },
        ]}
      />

      <Dropdown
        label="Editorial Board"
        items={[
          { label: "Editorial Board", href: "/editorial-board" },
          { label: "Advisory Board", href: "/advisory-board" },
        ]}
      />

      <Dropdown
        label="Author Guidelines"
        items={[
          { label: "Author Contributions", href: "/instructions/contributions" },
          { label: "Copyright Statement", href: "/instructions/copyright" },
          { label: "Transfer of Copyright", href: "/instructions/transfer" },
        ]}
      />

      <Dropdown
        label="Notice Board"
        items={[
          { label: "Call for Papers", href: "/notices/call-for-papers" },
        ]}
      />

      <Link href="/archive" style={navItemStyle}>Archives</Link>
      <Link href="/author/submit" style={navItemStyle}>Submission Portal</Link>
      <Link href="/contact" style={navItemStyle}>Contact Us</Link>

 {-------- AUTH SECTION (ADMIN LOGIN BASED) --------}

{!user && (
  <a
    href="/admin/login"
    style={{
      ...navItemStyle,
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      marginLeft: 8,
      fontWeight: 500,
    }}
  >
    Sign in
  </a>
)}

{user && (
  <>
    <a href="/author/dashboard" style={navItemStyle}>
      My Submissions
    </a>

    <a
      href="/admin"
      style={{
        ...navItemStyle,
        fontWeight: 600,
        color: "#6A3291",
      }}
    >
      Admin
    </a>

    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      }}
      style={{
        marginLeft: 8,
        padding: "6px 10px",
        fontSize: 13,
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "white",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  </>
)}
    </nav>
  );
}
*/
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

/* ---------------- styles ---------------- */

const navItemStyle: React.CSSProperties = {
  position: "relative",
  padding: "8px 10px",
  cursor: "pointer",
  color: "#374151",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  minWidth: 220,
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  padding: "6px 0",
  display: "none",
  zIndex: 50,
};

const dropdownItemStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 14px",
  fontSize: 13,
  color: "#111827",
  textDecoration: "none",
};

/* ---------------- dropdown ---------------- */

function Dropdown({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div
      style={navItemStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget.querySelector(".dropdown") as HTMLElement;
        if (el) el.style.display = "block";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.querySelector(".dropdown") as HTMLElement;
        if (el) el.style.display = "none";
      }}
    >
      {label}
      <div className="dropdown" style={dropdownStyle}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={dropdownItemStyle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#f3f4f6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- main nav ---------------- */

export default function MainNav() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function syncAuth() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!mounted) return;

      if (!user) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, approved")
        .eq("id", user.id)
        .maybeSingle();

      setIsLoggedIn(true);
      setIsAdmin(profile?.role === "admin" && profile?.approved === true);
      setLoading(false);
    }

    syncAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      syncAuth();
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return null;

  return (
    <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Dropdown
        label="Home"
        items={[
          { label: "About the Journal", href: "/about" },
          { label: "Aim and Scope", href: "/aim-scope" },
        ]}
      />

      <Dropdown
        label="Editorial Board"
        items={[
          { label: "Editorial Board", href: "/editorial-board" },
          { label: "Advisory Board", href: "/advisory-board" },
        ]}
      />

      <Dropdown
        label="Author Guidelines"
        items={[
          { label: "Author Contributions", href: "/instructions/contributions" },
          { label: "Copyright Statement", href: "/instructions/copyright" },
          { label: "Transfer of Copyright", href: "/instructions/transfer" },
        ]}
      />

      <Dropdown
        label="Notice Board"
        items={[
          { label: "Call for Papers", href: "/notices/call-for-papers" },
        ]}
      />

      <Link href="/archive" style={navItemStyle}>
        Archives
      </Link>

      <Link href="/author/submit" style={navItemStyle}>
        Submission Portal
      </Link>

      <Link href="/contact" style={navItemStyle}>
        Contact Us
      </Link>

      {/* ---------- AUTH SECTION ---------- */}

      {!isLoggedIn && (
  <Link
    href="/login"
    style={{
      ...navItemStyle,
      fontWeight: 600,
      color: "#6A3291",
    }}
  >
    Sign in
  </Link>
)}


      {isLoggedIn && isAdmin && (
        <Link
          href="/admin"
          style={{
            ...navItemStyle,
            fontWeight: 600,
            color: "#6A3291",
          }}
        >
          Admin
        </Link>
      )}

      {isLoggedIn && (
        <button
          onClick={handleLogout}
          style={{
            ...navItemStyle,
            background: "none",
            border: "none",
            fontWeight: 500,
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}
