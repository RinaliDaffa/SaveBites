"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

type AuthUserResponse = {
  data: { user: User | null };
  error: unknown;
};

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    client = createBrowserClient(url, key);
  }
  return client;
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = supabaseBrowser();
  const result = (await sb.auth.getUser()) as AuthUserResponse;
  return result.data.user ?? null;
}
