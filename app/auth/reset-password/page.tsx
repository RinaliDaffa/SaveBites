/**
 * SaveBites V3 — Reset Password Page
 * Called after clicking the password reset link from email.
 * User enters a new password twice to complete the reset flow.
 */

'use client';

import React, { useState, useTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { resetPasswordAction } from '@/lib/actions/auth';

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('password', password);
    formData.set('confirmPassword', confirmPassword);

    startTransition(async () => {
      const result = await resetPasswordAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🔐</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">Atur ulang kata sandi</h1>
          <p className="text-stone-500 text-sm mt-1">Masukkan kata sandi baru Anda</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm text-center">
              Kata sandi berhasil diubah! Mengalihkan ke halaman masuk...
            </div>
            <Button fullWidth variant="secondary" onClick={() => router.push('/auth/login')}>
              Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Ulangi kata sandi Anda"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              icon={<Lock className="w-4 h-4" />}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{error}</p>
            )}

            <Button type="submit" fullWidth loading={pending}>
              Update Password
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-stone-500">
          <button
            onClick={() => router.push('/auth/login')}
            className="text-emerald-600 font-medium hover:underline"
          >
            Kembali ke Masuk
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}