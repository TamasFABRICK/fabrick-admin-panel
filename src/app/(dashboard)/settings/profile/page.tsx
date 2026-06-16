"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { fetchApi } from "@/lib/apiClient";
import React, { useState } from "react";

export default function ProfileSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (newPassword !== confirmPassword) {
      setError("Nové heslo a potvrdenie sa nezhodujú.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Nové heslo musí mať aspoň 8 znakov.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi<any>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess((res.data as any)?.message || "Heslo bolo úspešne zmenené.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-800">Zmena hesla</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Zmeniť aktuálne heslo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 text-sm text-green-700 bg-green-50 rounded-xl border border-green-200">
                {success}
              </div>
            )}
            
            <Input 
              label="Aktuálne heslo" 
              type="password" 
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input 
              label="Nové heslo" 
              type="password" 
              placeholder="Min. 8 znakov"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input 
              label="Potvrdenie nového hesla" 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            
            <div className="pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Ukladám..." : "Uložiť nové heslo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
