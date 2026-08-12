'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearch from '@/components/ui/GlobalSearch';
import MobileFooterNav from '@/components/ui/MobileFooterNav';

export default function Navbar() {
  const { user, isAdmin, canMaintain, openAuthModal, signOut } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/movies', label: 'Movies' },
    { href: '/tv-series', label: 'TV Series' },
    { href: '/request', label: 'Request' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-500 ${scrolled
          ? 'bg-dark-950/90 backdrop-blur-md border-b border-white/5 shadow-2xl'
          : 'bg-gradient-to-b from-dark-950/80 to-transparent'
          }`}
        style={{ transform: 'translateZ(0)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16 lg:h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center flex-shrink-0 mr-2 lg:mr-6">
              <Image
                src="/logo.png"
                alt="DubLK"
                width={300}
                height={94}
                className="h-10 sm:h-12 md:h-13 lg:h-16 xl:h-18 w-auto object-contain transition-transform duration-200 hover:scale-[1.02]"
                priority
              />
            </Link>

            {/* Desktop Nav Links — clean text buttons, no outer border/pill */}
            <div className="hidden md:flex items-center gap-1 flex-shrink-0">
              {navLinks.map(({ href, label }) => {
                const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 py-2 text-sm rounded-xl transition-all duration-200 ${isActive
                      ? 'text-white bg-white/12 font-medium'
                      : 'text-dark-300 hover:text-white hover:bg-white/6'
                      }`}
                  >
                    {label}
                  </Link>
                );
              })}
              {canMaintain && (
                <Link
                  href="/admin"
                  className={`px-4 py-2 text-sm rounded-xl transition-all duration-200 ${pathname === '/admin'
                    ? 'text-brand-300 bg-brand-500/20 font-medium'
                    : 'text-brand-400 hover:text-brand-300 hover:bg-brand-500/8'
                    }`}
                >
                  Admin
                </Link>
              )}
            </div>

            {/* Spacer — pushes search + avatar to the right */}
            <div className="flex-1" />

            {/* Search bar — desktop only, sits between nav links and avatar */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-3 px-4 py-2 w-52 lg:w-64 xl:w-72 bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-full text-dark-400 hover:text-white transition-all duration-200 group"
              aria-label="Search"
            >
              <svg className="w-4 h-4 flex-shrink-0 group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm flex-1 text-left">Search...</span>
            </button>

            {/* Right section — avatar / sign-in + mobile hamburger */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all duration-200"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <svg className={`hidden sm:block w-4 h-4 text-dark-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-dark-800/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 animate-scale-in overflow-hidden">
                        <div className="p-4 border-b border-white/5">
                          <p className="text-sm text-white font-medium truncate">{user.email}</p>
                          <p className="text-xs text-dark-400 mt-0.5">
                            {isAdmin ? '👑 Super Admin' : canMaintain ? '🎬 Editor / Mod' : 'Member'}
                          </p>
                        </div>
                        <div className="p-2">
                          {canMaintain && (
                            <Link
                              href="/admin"
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-3 px-3 py-2.5 text-sm text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Admin Panel
                            </Link>
                          )}
                          <Link
                            href="/dashboard"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Dashboard
                          </Link>
                          <button
                            onClick={() => { signOut(); setProfileOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => openAuthModal()}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-400 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200"
                >
                  Sign In
                </button>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-dark-400 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/5 py-4 animate-fade-in">
              <div className="space-y-1">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-dark-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  >
                    {label}
                  </Link>
                ))}
                {canMaintain && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-all"
                  >
                    Admin Panel
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Global Search Overlay */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile bottom nav */}
      <MobileFooterNav onSearchOpen={() => setSearchOpen(true)} />
    </>
  );
}
