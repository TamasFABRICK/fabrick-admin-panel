"use client";

import React from "react";
import { useAuth } from "@/lib/AuthContext";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 shadow-sm">
      <h2 className="text-lg font-medium text-neutral-800">Prehľad</h2>
      <div className="flex items-center gap-4">
        <div className="text-sm text-neutral-500">
          Prihlásený ako: <strong>{user?.email || 'Používateľ'}</strong>
        </div>
      </div>
    </header>
  );
}
