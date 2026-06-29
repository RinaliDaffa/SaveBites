/**
 * SaveBites V3 — Navbar Component
 * Shared top navigation bar with logo, role indicator, and actions.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Menu, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/components/shared/cn';
import { useAuthStore } from '@/lib/stores/auth';
import { Button } from '@/components/primitives/Button';
import { logoutAction } from '@/lib/actions/auth';

interface NavbarProps {
  activeTab?: string;
}

export function Navbar({ activeTab = 'home' }: NavbarProps) {
  const { user, signOut, role } = useAuthStore();

  const handleLogout = async () => {
    // Sign out from Supabase (server) then clear zustand store
    await logoutAction();
    signOut();
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Location */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <span className="text-xl font-bold text-stone-900">SaveBites</span>
            </Link>

            {user && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-stone-500">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>Yogyakarta</span>
              </div>
            )}
          </div>

          {/* Center: Tabs */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/c/discover">
              <Button variant="ghost" size="sm" className={cn(activeTab === 'discover' && 'bg-emerald-50 text-emerald-700')}>
                Discover
              </Button>
            </Link>
            {user && role === 'merchant' && (
              <Link href="/m/dashboard">
                <Button variant="ghost" size="sm" className={cn(activeTab === 'dashboard' && 'bg-emerald-50 text-emerald-700')}>
                  Dasbor
                </Button>
              </Link>
            )}
          </div>

          {/* Right: Auth */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-1.5 text-sm">
                  <User className="w-4 h-4 text-stone-400" />
                  <span className="text-stone-600">{user.full_name || 'User'}</span>
                </div>
                <Link href={role === 'merchant' ? '/m/settings' : '/c/account'}>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
