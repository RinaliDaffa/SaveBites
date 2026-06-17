"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, supabaseBrowser } from "@/lib/supabase-browser";

const NAV_ITEMS = [
  { href: "/app/listings", label: "Discover", icon: "🍱" },
  { href: "/app/tickets", label: "Tickets", icon: "🎟️" },
  { href: "/app/profile", label: "Profile", icon: "👤" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((user) => {
      if (cancelled) return;
      setEmail(user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await supabaseBrowser().auth.signOut();
    setMenuOpen(false);
    router.push("/auth/login");
    router.refresh();
  }

  const initial = email ? email[0]?.toUpperCase() : "?";

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-ink">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-screen-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/app/listings"
            className="font-serif text-xl font-bold text-emerald-600"
          >
            SaveBites
          </Link>
          <div className="relative">
            <button
              type="button"
              aria-label="Account menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white font-semibold flex items-center justify-center hover:bg-emerald-700 transition-colors"
            >
              {initial}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 text-xs text-stone-500 border-b border-stone-100 truncate">
                  {email ?? "Not signed in"}
                </div>
                <Link
                  href="/app/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  Profile
                </Link>
                <Link
                  href="/app/tickets"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  My tickets
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-tomato hover:bg-red-50 border-t border-stone-100"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <nav className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-screen-md mx-auto grid grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/app/listings"
                ? pathname === item.href || pathname.startsWith("/app/listings")
                : item.href === "/app/tickets"
                ? pathname.startsWith("/app/tickets")
                : pathname.startsWith("/app/profile");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "text-emerald-700"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
