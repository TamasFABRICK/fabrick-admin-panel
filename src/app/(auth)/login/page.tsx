"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/AuthContext";
import React, { useState } from "react";
import { fetchApi } from "@/lib/apiClient";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [mode, setMode] = useState<"login" | "reset">("login");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        let errorMsg = "Nesprávne prihlasovacie údaje";
        if (data.error && typeof data.error === "string") errorMsg = data.error;
        else if (data.error?.message) errorMsg = data.error.message;
        else if (data.message) errorMsg = data.message;
        throw new Error(errorMsg);
      }

      if (data.data?.token) {
        login(data.data.token);
      } else {
        throw new Error("Token nenájdený v odpovedi");
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const data = await fetchApi<any>("/api/auth/reset-request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccessMsg((data.data as any)?.message || "Inštrukcie na resetovanie boli odoslané.");
      setMode("login");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
          FABRICK
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          {mode === "login" ? "Prihláste sa do administrácie konfigurátora" : "Obnova zabudnutého hesla"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="px-4 py-8 sm:px-10">
          {mode === "login" ? (
            <form className="space-y-6" onSubmit={handleLoginSubmit}>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-3 text-sm text-green-700 bg-green-50 rounded-xl border border-green-200">
                  {successMsg}
                </div>
              )}
              
              <Input 
                label="E-mailová adresa" 
                type="email" 
                placeholder="admin@fabrick.sk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-neutral-700">Heslo</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 pr-10 text-neutral-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 sm:text-sm transition-colors"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-900">
                    Zapamätať prihlásenie
                  </label>
                </div>
                <div className="text-sm">
                  <button type="button" onClick={() => setMode("reset")} className="font-medium text-primary hover:text-primary/80">
                    Zabudli ste heslo?
                  </button>
                </div>
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Prihlasujem..." : "Prihlásiť sa"}
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleResetSubmit}>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                  {error}
                </div>
              )}
              
              <Input 
                label="E-mailová adresa" 
                type="email" 
                placeholder="meno@firma.sk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
              
              <div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Odosielam..." : "Odoslať inštrukcie"}
                </Button>
              </div>
              <div className="text-center text-sm">
                <button type="button" onClick={() => setMode("login")} className="font-medium text-primary hover:text-primary/80">
                  Späť na prihlásenie
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
