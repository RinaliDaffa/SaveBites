/**
 * SaveBites V3 — Registration Page
 * Role-aware registration with consumer or merchant signup.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { registerSchema } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'consumer' as 'consumer' | 'merchant',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsed: { fullName: string; phone: string; role: 'consumer' | 'merchant' };
    try {
      parsed = registerSchema.parse(form) as typeof parsed;
    } catch {
      setError('Please fill in all required fields correctly.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: parsed.fullName,
            phone: parsed.phone,
            role: parsed.role,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Profile row is auto-created by the `on_auth_user_created` trigger
      // (see supabase/migrations/00000000000001_init.sql), which reads
      // `full_name`, `phone`, and `role` from raw_user_meta_data. No explicit insert
      // here — that would conflict on the primary key.
      if (!data.user) {
        setError('Sign-up succeeded but no user was returned. Please try again.');
        return;
      }

      // Redirect to login regardless of whether Supabase returned a session
      // (if email confirmation is required, the user must confirm first).
      router.push('/auth/login?registered=true');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🛡️</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">Buat akun</h1>
          <p className="text-stone-500 text-sm mt-1">Bergabunglah dengan SaveBites untuk memerangi limbah makanan</p>
        </div>

        {/* Role Toggle */}
        <div role="radiogroup" aria-label="Pilih peran" className="flex bg-stone-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, role: 'consumer' }))}
            aria-checked={form.role === 'consumer'}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              form.role === 'consumer' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'
            }`}
          >
            🍽️ Consumer
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, role: 'merchant' }))}
            aria-checked={form.role === 'merchant'}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              form.role === 'merchant' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'
            }`}
          >
            🏪 Merchant
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={form.fullName}
            onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
            icon={<User className="w-4 h-4" />}
          />

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
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            icon={<Lock className="w-4 h-4" />}
          />

          <Input
            label="Phone"
            type="tel"
            placeholder="+62 812 xxxx xxxx"
            value={form.phone}
            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
            icon={<Phone className="w-4 h-4" />}
            required
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Buat Akun {form.role === 'merchant' ? 'Merchant' : ''}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-stone-500">
          Sudah punya akun?{' '}
          <button
            onClick={() => router.push('/auth/login')}
            className="text-emerald-600 font-medium hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
