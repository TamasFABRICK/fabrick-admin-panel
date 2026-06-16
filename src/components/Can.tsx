"use client";

import { useAuth } from "@/lib/AuthContext";
import React from "react";

interface CanProps {
  I: string;
  children: React.ReactNode;
}

export function Can({ I, children }: CanProps) {
  const { user } = useAuth();
  
  if (!user) return null;
  
  // Super admin má prístup ku všetkému
  if (user.role === "super_admin") {
    return <>{children}</>;
  }
  
  // Zistíme, či má používateľ dané oprávnenie
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.includes(I)) {
    return <>{children}</>;
  }
  
  return null;
}
