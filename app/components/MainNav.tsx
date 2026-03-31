"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type NavItem = {
  label: string;
  href: string;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Home",
    items: [
      { label: "About the Journal", href: "/about" },
      { label: "Aim and Scope", href: "/aim-scope" },
    ],
  },
  {
    label: "Editorial Board",
    items: [
      { label: "Editorial Board", href: "/editorial-board" },
      { label: "Advisory Board", href: "/advisory-board" },
    ],
  },
  {
    label: "Author Guidelines",
    items: [
      { label: "Author Contributions", href: "/instructions/contributions" },
      { label: "Copyright Statement", href: "/instructions/copyright" },
      { label: "Transfer of Copyright", href: "/instructions/transfer" },
    ],
  },
  {
    label: "Notice Board",
    items: [{ label: "Call for Papers", href: "/notices/call-for-papers" }],
  },
];

const PRIMARY_LINKS: NavItem[] = [
  { label: "Archives", href: "/archive" },
  { label: "Submission Portal", href: "/author/submit" },
  { label: "Contact Us", href: "/contact" },
];

function DesktopDropdown({
  label,
  items,
}: {
  label: string;
  items: NavItem[];
}) {
  return (
    <div className="site-nav__group">
      <button
        type="button"
        className="site-nav__link site-nav__trigger"
        aria-haspopup="true"
      >
        {label}
      </button>

      <div className="site-nav__dropdown">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="site-nav__dropdownLink">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MainNav() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function syncAuth() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!mounted) return;

      if (!user) {
        setIsLoggedIn(false);
        setIsStaff(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, approved")
        .eq("id", user.id)
        .maybeSingle();

      setIsLoggedIn(true);
      setIsStaff(
        profile?.approved === true &&
          ["admin", "editor", "reviewer", "owner"].includes(profile?.role || "")
      );
      setLoading(false);
    }

    void syncAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void syncAuth();
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="site-nav site-nav--loading" />;
  }

  return (
    <div className="site-nav">
      <nav className="site-nav__desktop" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <DesktopDropdown key={group.label} {...group} />
        ))}

        {PRIMARY_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="site-nav__link">
            {item.label}
          </Link>
        ))}

        {!isLoggedIn && (
          <Link href="/login" className="site-nav__auth">
            Sign in
          </Link>
        )}

        {isLoggedIn && (
          <Link href="/author/dashboard" className="site-nav__link">
            My Submissions
          </Link>
        )}

        {isLoggedIn && isStaff && (
          <Link href="/admin" className="site-nav__auth">
            Admin
          </Link>
        )}

        {isLoggedIn && (
          <button type="button" className="site-nav__button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </nav>

      <button
        type="button"
        className="site-nav__toggle"
        aria-expanded={mobileOpen}
        aria-controls="site-nav-mobile"
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
        <span className="site-nav__toggleLabel">
          {mobileOpen ? "Close" : "Menu"}
        </span>
      </button>

      {mobileOpen && (
        <nav id="site-nav-mobile" className="site-nav__mobile" aria-label="Mobile">
          <div className="site-nav__mobilePanel">
            {NAV_GROUPS.map((group) => {
              const isOpen = openGroup === group.label;

              return (
                <div key={group.label} className="site-nav__mobileGroup">
                  <button
                    type="button"
                    className="site-nav__mobileTrigger"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenGroup((prev) => (prev === group.label ? null : group.label))
                    }
                  >
                    <span>{group.label}</span>
                    <span>{isOpen ? "-" : "+"}</span>
                  </button>

                  {isOpen && (
                    <div className="site-nav__mobileLinks">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="site-nav__mobileLink"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="site-nav__mobileLinks site-nav__mobileLinks--flat">
              {PRIMARY_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="site-nav__mobileLink">
                  {item.label}
                </Link>
              ))}

              {isLoggedIn && (
                <Link href="/author/dashboard" className="site-nav__mobileLink">
                  My Submissions
                </Link>
              )}

              {isLoggedIn && isStaff && (
                <Link href="/admin" className="site-nav__mobileLink site-nav__mobileLink--accent">
                  Admin
                </Link>
              )}

              {!isLoggedIn && (
                <Link href="/login" className="site-nav__mobileLink site-nav__mobileLink--accent">
                  Sign in
                </Link>
              )}

              {isLoggedIn && (
                <button
                  type="button"
                  className="site-nav__mobileButton"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
