"use client";

import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <nav className="fixed top-0 w-full z-50 glass-strong" style={{ borderBottom: '1px solid #38444D' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1DA1F2, #00BA7C)', boxShadow: '0 4px 15px rgba(29,161,242,0.2)' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">Personalized Email Sender</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 glass px-4 py-2 rounded-full">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-8 h-8 rounded-full"
                  style={{ border: '2px solid #1DA1F2' }}
                />
              )}
              <span className="text-sm font-medium text-white hidden sm:block">
                {session.user?.name || session.user?.email}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm transition-colors hover:text-white"
              style={{ color: '#8899A6' }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
