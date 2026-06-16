"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MarketingSettings = {
  gtmId: string;
  ga4Id: string;
  googleAdsId: string;
  metaPixelId: string;
  seoTitle: string;
  seoDescription: string;
  customHeadScripts: string;
};

export default function MarketingSettingsPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<MarketingSettings>({
    gtmId: "",
    ga4Id: "",
    googleAdsId: "",
    metaPixelId: "",
    seoTitle: "",
    seoDescription: "",
    customHeadScripts: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Token guard: wait for AuthContext hydration before calling API
    if (!token) return;
    if (user && user.role === "viewer") {
      router.push("/");
    } else if (user) {
      loadSettings();
    }
  }, [token, user]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<MarketingSettings>("/api/settings/marketing");
      if (res.data) {
        setSettings({
          gtmId: res.data.gtmId || "",
          ga4Id: res.data.ga4Id || "",
          googleAdsId: res.data.googleAdsId || "",
          metaPixelId: res.data.metaPixelId || "",
          seoTitle: res.data.seoTitle || "",
          seoDescription: res.data.seoDescription || "",
          customHeadScripts: res.data.customHeadScripts || "",
        });
      }
      setError("");
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa načítať nastavenia marketingu.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const payload = Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [key, value === "" ? null : value])
    );

    try {
      await fetchApi("/api/settings/marketing", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSuccess(true);
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa uložiť nastavenia marketingu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-neutral-500">Načítavam nastavenia...</div>;
  if (user?.role === "viewer") return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">Marketing a SEO</h1>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary-hover text-white shadow-sm">
          {saving ? "Ukladám..." : "Uložiť zmeny"}
        </Button>
      </div>

      {error && <div className="p-4 text-red-600 bg-red-50 rounded-xl border border-red-100">{error}</div>}
      {success && <div className="p-4 text-green-700 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2">
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Zmeny boli úspešne uložené.
      </div>}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Karta 1: Sledovacie kódy */}
        <Card>
          <CardHeader>
            <CardTitle>Sledovacie kódy (Analytika)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Google Tag Manager (GTM ID)</label>
                <input 
                  type="text" 
                  name="gtmId"
                  value={settings.gtmId}
                  onChange={handleChange}
                  placeholder="GTM-XXXXXXX"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Google Analytics 4 (G-ID)</label>
                <input 
                  type="text" 
                  name="ga4Id"
                  value={settings.ga4Id}
                  onChange={handleChange}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Google Ads (AW-ID)</label>
                <input 
                  type="text" 
                  name="googleAdsId"
                  value={settings.googleAdsId}
                  onChange={handleChange}
                  placeholder="AW-XXXXXXXXX"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Meta Pixel ID</label>
                <input 
                  type="text" 
                  name="metaPixelId"
                  value={settings.metaPixelId}
                  onChange={handleChange}
                  placeholder="123456789012345"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Karta 2: SEO a Metadáta */}
        <Card>
          <CardHeader>
            <CardTitle>SEO a Metadáta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Titulok stránky</label>
              <input 
                type="text" 
                name="seoTitle"
                value={settings.seoTitle}
                onChange={handleChange}
                placeholder="Napr. FABRICK Konfigurátor"
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-neutral-700">Meta popis</label>
                <span className={`text-xs ${settings.seoDescription.length > 160 ? "text-red-500 font-medium" : "text-neutral-500"}`}>
                  {settings.seoDescription.length} / 160 znakov
                </span>
              </div>
              <textarea 
                name="seoDescription"
                value={settings.seoDescription}
                onChange={handleChange}
                rows={3}
                placeholder="Zadajte krátky popis stránky pre vyhľadávače..."
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
              />
            </div>
          </CardContent>
        </Card>

        {/* Karta 3: Pre pokročilých */}
        <Card>
          <CardHeader>
            <CardTitle>Pre pokročilých</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Vlastné &lt;head&gt; skripty
              </label>
              <p className="text-xs text-neutral-500 mb-2">
                Tento kód bude vložený priamo do &lt;head&gt; sekcie verejného konfigurátora bez akýchkoľvek úprav. Použite pre dodatočné sledovacie kódy (Hotjar, vlastný Pixel a pod.). Nezabudnite na &lt;script&gt; tagy. Limit je 10 000 znakov.
              </p>
              <textarea 
                name="customHeadScripts"
                value={settings.customHeadScripts}
                onChange={handleChange}
                rows={6}
                maxLength={10000}
                placeholder="<script>\n  // Váš kód\n</script>"
                className="w-full px-3 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm bg-neutral-50"
              />
            </div>
          </CardContent>
        </Card>

      </form>
    </div>
  );
}
