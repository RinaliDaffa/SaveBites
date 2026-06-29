/**
 * SaveBites V3 — Forgot Password Page
 * Email-based password reset flow via Server Action.
 */

'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { forgotPasswordAction } from '@/lib/actions/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('email', email);

    startTransition(async () => {
      const result = await forgotPasswordAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🔑</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">Atur ulang kata sandi</h1>
          <p className="text-stone-500 text-sm mt-1">Masukkan email Anda untuk menerima tautan pengaturan ulang</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm text-center">
              We&apos;ve sent a password reset link to your email.
            </div>
            <Button fullWidth variant="secondary" onClick={() => router.push('/auth/login')}>
              Kembali ke Masuk
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={<Mail className="w-4 h-4" />}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
            )}

            <Button type="submit" fullWidth loading={pending}>
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}