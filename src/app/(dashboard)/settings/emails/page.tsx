"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";

const DYNAMIC_VARIABLES = [
  { label: "Meno", code: "{{firstName}}" },
  { label: "Priezvisko", code: "{{lastName}}" },
  { label: "E-mail", code: "{{email}}" },
  { label: "Telefón", code: "{{phone}}" },
  { label: "Spoločnosť", code: "{{company}}" },
  { label: "Mesto", code: "{{city}}" },
  { label: "Poznámka", code: "{{note}}" },
  { label: "HTML Tabuľka Konfigurácie", code: "{{configHtml}}" },
  { label: "Náhľad Konfigurácie (Obrázok)", code: "{{previewImageTag}}" }
];

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const hasWritePermission = user?.role === "super_admin" || user?.permissions?.includes("email:write");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any[]>("/api/templates/email");
      setTemplates(res.data || []);
      if (res.data && res.data.length > 0) {
        handleSelectTemplate(res.data[0]);
      }
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa načítať šablóny");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await fetchApi("/api/templates/email", {
        method: "PUT",
        body: JSON.stringify({
          id: selectedTemplate.id,
          subject,
          bodyHtml
        })
      });
      setSuccess("Šablóna bola úspešne uložená.");
      
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? updated.data : t));
    } catch (err: any) {
      setError(err.message || "Nepodarilo sa uložiť šablónu");
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (code: string) => {
    setBodyHtml(prev => prev + code);
  };

  if (loading) {
    return <div className="p-6">Načítavam e-mailové šablóny...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-800">E-mailové šablóny</h1>
        <Button onClick={handleSave} disabled={saving || !hasWritePermission}>
          {saving ? "Ukladám..." : "Uložiť šablónu"}
        </Button>
      </div>

      {error && <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>}
      {success && <div className="p-4 text-green-700 bg-green-50 rounded-lg">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zoznam šablón</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`text-left px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors ${selectedTemplate?.id === t.id ? 'bg-primary/5 border-l-2 border-l-primary font-medium text-primary' : 'text-neutral-700'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dynamické premenné</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-neutral-500 mb-2">Kliknutím pridáte premennú na koniec editora.</p>
              {DYNAMIC_VARIABLES.map(v => (
                <button
                  key={v.code}
                  onClick={() => insertVariable(v.code)}
                  className="w-full text-left px-2 py-1.5 text-xs font-mono bg-neutral-100 hover:bg-neutral-200 rounded text-neutral-700 transition-colors"
                >
                  <span className="font-sans font-medium block mb-0.5">{v.label}</span>
                  {v.code}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <CardTitle>Editácia: {selectedTemplate.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Predmet e-mailu</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={!hasWritePermission}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">HTML Telo e-mailu</label>
                  <textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    disabled={!hasWritePermission}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm h-64 resize-y disabled:bg-neutral-100"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center text-neutral-500 bg-white rounded-xl border border-neutral-200">
              Vyberte šablónu zo zoznamu
            </div>
          )}

          {/* Live Preview */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Živý náhľad (Live Preview)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border border-neutral-200 rounded-lg p-6 bg-white overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ 
                    __html: bodyHtml.replace(
                      /\{\{previewImageTag\}\}/g,
                      '<div style="max-width: 100%; height: 200px; background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: bold; margin-top: 15px;">NÁHĽAD OBRÁZKA SA ZOBRAZÍ TU</div>'
                    ) 
                  }} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
