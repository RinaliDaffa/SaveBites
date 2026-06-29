/**
 * SaveBites V3 — Authentication Server Actions
 * Replaces POST /api/auth/* with typed Server Actions so forms can call them
 * directly via `<form action={loginAction}>` for progressive enhancement.
 *
 * Conventions:
 * - Always return `ActionResult<T>` discriminated union — never throw across the wire.
 * - Use `redirect()` for post-auth navigation; throws so the function must NOT
 *   claim success afterwards.
 * - Call `revalidatePath()` to invalidate any route whose server-rendered data
 *   depends on the mutation (auth state, profile, etc.).
 * - All rate-limited actions bucket by client IP (read via `headers()`).
 */

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  loginLimit,
  registerLimit,
  forgotPasswordLimit,
  resetPasswordLimit,
} from '@/lib/security/rate-limit';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations';

// ─── Result type ────────────────────────────────────────────────

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ─── Rate-limit helpers (Server Actions don't have NextRequest) ──

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) {
      const first = fwd.split(',')[0]?.trim();
      if (first) return first;
    }
    const real = h.get('x-real-ip');
    if (real) return real.trim();
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf.trim();
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function rateLimitFail<TData>(
  policy: { check: (key: string) => Promise<{ success: boolean; retryAfterMs: number }> },
  key: string
): Promise<ActionResult<TData> | null> {
  const result = await policy.check(key);
  if (result.success) return null;
  const wait = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return {
    success: false,
    error: `Terlalu banyak percobaan. Coba lagi dalam ${wait} detik.`,
  };
}

// ─── loginAction ────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const ip = await getClientIp();
  const limited = await rateLimitFail(loginLimit, `login:${ip}`);
  if (limited) return limited;

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, error: 'Email atau password salah' };
  }

  // Read role from profiles table to decide redirect target.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'merchant') {
      redirect('/m/dashboard');
    }
  }

  // Default: send consumers to discovery. Middleware will also enforce role.
  redirect('/c/discover');
}

// ─── registerAction ─────────────────────────────────────────────

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const ip = await getClientIp();
  const limited = await rateLimitFail(registerLimit, `register:${ip}`);
  if (limited) return limited;

  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    return {
      success: false,
      error: 'Pendaftaran gagal. Email mungkin sudah digunakan.',
    };
  }

  // Profile is auto-created by the on_auth_user_created DB trigger (handle_new_user),
  // which copies full_name and role from signUp metadata into profiles(id, email, full_name, role).
  // No manual insert needed — attempting one would collide on the PK.

  revalidatePath('/');
  // After registration, route based on the chosen role:
  // - Merchants go to the onboarding flow to set up their store.
  // - Consumers go straight to discovery (which middleware will further enforce).
  // If Supabase requires email confirmation, Supabase's email link will redirect
  // through /auth/confirm and the role-aware middleware will handle that.
  const registeredRole = parsed.data.role;
  if (registeredRole === 'merchant') {
    redirect('/m/onboarding?registered=true');
  }
  redirect('/c/discover');
}

// ─── updateProfileAction ────────────────────────────────────────

export async function updateProfileAction(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Sesi tidak valid' };
  }

  const updates: Record<string, string | null> = {};
  const fullName = formData.get('full_name');
  const phone = formData.get('phone');

  if (typeof fullName === 'string' && fullName.trim().length > 0) {
    updates.full_name = fullName.trim();
  } else {
    updates.full_name = null;
  }

  if (typeof phone === 'string' && phone.trim().length > 0) {
    updates.phone = phone.trim();
  } else {
    updates.phone = null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.error('updateProfileAction — update error:', error);
    return { success: false, error: 'Gagal memperbarui profil' };
  }

  revalidatePath('/m/settings');
  revalidatePath('/c/account');

  return { success: true };
}

// ─── logoutAction ───────────────────────────────────────────────

export async function logoutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('logoutAction — signOut error:', error);
    return { success: false, error: 'Gagal keluar' };
  }

  revalidatePath('/');
  redirect('/');
}

// ─── forgotPasswordAction ───────────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const ip = await getClientIp();
  const limited: ActionResult<{ message: string }> | null = await rateLimitFail(
    forgotPasswordLimit,
    `forgot:${ip}`
  );
  if (limited) return limited;

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Email tidak valid',
    };
  }

  const supabase = await createClient();

  // Don't leak whether the email exists — always return a generic success.
  // We still call the API so that valid emails trigger a real reset email.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  });

  return {
    success: true,
    data: {
      message:
        'Jika email terdaftar, tautan reset password telah dikirim ke inbox Anda.',
    },
  };
}

// ─── resetPasswordAction ────────────────────────────────────────

export async function resetPasswordAction(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const ip = await getClientIp();
  const limited: ActionResult<{ message: string }> | null = await rateLimitFail(
    resetPasswordLimit,
    `reset:${ip}`
  );
  if (limited) return limited;

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return {
      success: false,
      error: 'Sesi tidak valid. Silakan minta tautan reset password baru.',
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error('resetPasswordAction — updateUser error:', error);
    return { success: false, error: 'Gagal mengubah password' };
  }

  return {
    success: true,
    data: { message: 'Password berhasil diubah' },
  };
}
