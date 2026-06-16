"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { name: "Dashboard", href: "/" },
  { name: "Produkty", href: "/products", requiredPermission: "products:read" },
  { name: "CRM Kontakty", href: "/crm", requiredPermission: "crm:read" },
  { name: "Marketing a SEO", href: "/settings/marketing", requiredPermission: "marketing:read" },
  { name: "Nastavenia (Atribúty)", href: "/settings/attributes", requiredPermission: "settings:read" },
  { name: "E-mailové šablóny", href: "/settings/emails", requiredPermission: "email:read" },
  { name: "GDPR Text", href: "/settings/gdpr", requiredPermission: "settings:read" },
  { name: "Zmena hesla", href: "/settings/profile", requiredPermission: "password:read" },
  { name: "Prístupové práva", href: "/users", requiredPermission: "users:read" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const role = user?.role || "viewer";
  const permissions = user?.permissions || [];

  const visibleNavItems = navItems.filter((item) => {
    if (role === "super_admin") return true;
    if (item.requiredPermission) {
      return permissions.includes(item.requiredPermission);
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col h-full shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-neutral-200">
        <h1 className="text-xl font-bold text-primary">FABRICK</h1>
        <span className="ml-2 text-sm text-neutral-500">Admin</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-neutral-200">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors group"
        >
          <svg className="w-5 h-5 text-neutral-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Odhlásiť sa
        </button>
      </div>
    </aside>
  );
}
