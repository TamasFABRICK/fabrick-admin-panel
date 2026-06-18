"use client";

import React from "react";
import { useAuth } from "@/lib/AuthContext";

interface HeaderProps {
  onMenuOpen: () => void;
}

export function Header({ onMenuOpen }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger button – visible only on mobile */}
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Otvoriť menu"
          id="mobile-menu-btn"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-base sm:text-lg font-medium text-neutral-800">Prehľad</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xs sm:text-sm text-neutral-500 truncate max-w-[160px] sm:max-w-none">
          Prihlásený ako: <strong>{user?.email || "Používateľ"}</strong>
        </div>
      </div>
    </header>
  );
}
