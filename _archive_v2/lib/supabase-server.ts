import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
  );
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const cookieMethods: CookieMethodsServer = {
    async getAll() {
      const store = await cookieStore;
      return store.getAll();
    },
    async setAll(cookiesToSet) {
      const store = await cookieStore;
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          store.set(name, value, options);
        });
      } catch {
        // setAll called from a Server Component is a no-op when cookies cannot
        // be written. Middleware refreshes the session, so this is safe to ignore.
      }
    },
  };
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieMethods,
  });
}
