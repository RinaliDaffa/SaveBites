"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, supabaseBrowser } from "@/lib/supabase-browser";

interface ProfileRow {
  id: string;
  full_name: string;
  role: "consumer" | "merchant";
}

export default function ProfilePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Edit form state
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then(async (user) => {
      if (cancelled) return;
      if (!user) {
        setAuthReady(true);
        return;
      }
      setEmail(user.email ?? null);
      const sb = supabaseBrowser();
      const { data: p, error: perr } = await sb
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (perr) {
        setError(perr.message);
      } else if (p) {
        const row = p as ProfileRow;
        setProfile(row);
        setFullName(row.full_name);
      }
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error: uerr } = await sb
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile.id);
    setSaving(false);
    if (uerr) {
      setError(uerr.message);
      return;
    }
    setProfile({ ...profile, full_name: fullName });
    setSavedAt(Date.now());
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseBrowser().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto w-full px-4 py-5 text-stone-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!email) {
    return (
      <div className="max-w-md mx-auto w-full px-4 py-5">
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-stone-700 font-medium">Sign in to see your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 py-5 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-ink">Profile 👤</h1>
        <p className="text-sm text-stone-500 mt-1">{email}</p>
      </div>

      {profile ? (
        <div className="inline-flex self-start">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              profile.role === "consumer"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {profile.role === "consumer" ? "CONSUMER" : "MERCHANT"}
          </span>
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-700">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </label>
        {error ? (
          <div className="text-sm text-tomato bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : null}
        {savedAt ? (
          <p className="text-xs text-emerald-700">Saved</p>
        ) : null}
        <button
          type="submit"
          disabled={saving || !profile}
          className="bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="bg-stone-100 text-stone-700 font-medium py-2.5 rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
