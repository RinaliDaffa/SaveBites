/**
 * SaveBites V3 — Login Page
 * Email/password login with role-aware redirect via middleware.
 */

'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { useAuthStore } from '@/lib/stores/auth';
import { loginSchema } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get('registered') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    try {
      loginSchema.parse(form);
    } catch {
      setError('Please enter a valid email and password.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        setError('Email atau password salah');
        return;
      }

      if (!data.user) {
        setError('Login gagal. Silakan coba lagi.');
        return;
      }

      // Read role from profiles table for client-side redirect.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const role = profile?.role === 'merchant' ? 'merchant' : 'consumer';
      const target =
        role === 'merchant' ? '/m/dashboard' : '/c/discover';

      signIn(profile, role);
      // Use hard navigation so middleware re-reads the session cookie
      // and enforces role-based routing before the next page renders.
      window.location.href = target;
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-4xl">🛡️</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">Selamat datang kembali</h1>
          <p className="text-stone-500 text-sm mt-1">Masuk ke akun SaveBites Anda</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {justRegistered && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl">
              Akun berhasil dibuat. Silakan masuk.
            </p>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            icon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            icon={<Lock className="w-4 h-4" />}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Masuk
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-stone-500">
          Belum punya akun?{' '}
          <button
            onClick={() => router.push('/auth/register')}
            className="text-emerald-600 font-medium hover:underline"
          >
            Daftar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center"><p className="text-stone-500">Memuat...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
