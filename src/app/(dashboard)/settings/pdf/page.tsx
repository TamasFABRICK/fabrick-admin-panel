"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";

// ─── PDF Template dynamic variables ───────────────────────────────────────────
const PDF_VARIABLES = [
  // Kontakt
  { label: "Meno", code: "{{firstName}}" },
  { label: "Priezvisko", code: "{{lastName}}" },
  { label: "E-mail", code: "{{email}}" },
  { label: "Telefón", code: "{{phone}}" },
  { label: "Spoločnosť", code: "{{company}}" },
  { label: "Mesto", code: "{{city}}" },
  // Produkt
  { label: "Názov tehly", code: "{{brickName}}" },
  { label: "Formát tehly", code: "{{brickFormat}}" },
  { label: "Výrobca", code: "{{manufacturer}}" },
  { label: "Kód produktu", code: "{{articleCode}}" },
  { label: "Rozmery", code: "{{dimensions}}" },
  { label: "Cena / m²", code: "{{price}}" },
  // Konfigurácia
  { label: "Väzba (pattern)", code: "{{patternName}}" },
  { label: "Farba škáry", code: "{{jointColor}}" },
  { label: "Náhľad tehly (img tag)", code: "{{brickPreviewImg}}" },
  { label: "Logo Fabrick (img tag)", code: "{{fabrickLogoImg}}" },
  { label: "Aktuálny dátum", code: "{{date}}" },
];

// ─── Tab type ─────────────────────────────────────────────────────────────────
type Tab = "html" | "css" | "preview";

interface PdfTemplate {
  id: string;
  code: string;
  name: string;
  bodyHtml: string;
  cssStyles: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PdfTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("html");

  // Editor fields
  const [bodyHtml, setBodyHtml] = useState("");
  const [cssStyles, setCssStyles] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const hasWritePermission =
    user?.role === "super_admin" || user?.permissions?.includes("email:write");

  // ── Load templates on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadTemplates();
  }, []);

  // ── Live preview update ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "preview" && previewIframeRef.current) {
      const doc = previewIframeRef.current.contentDocument;
      if (doc) {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssStyles || ""}</style></head><body>${bodyHtml}</body></html>`;
        doc.open();
        doc.write(fullHtml);
        doc.close();
      }
    }
  }, [activeTab, bodyHtml, cssStyles]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<PdfTemplate[]>("/api/templates/pdf");
      const data = res.data;

      if (!data || (Array.isArray(data) && data.length === 0)) {
        setTemplates([]);
        setSelectedTemplate(null);
        return;
      }

      setTemplates(data);
      if (data.length > 0) {
        handleSelectTemplate(data[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nepodarilo sa načítať PDF šablóny";
      setError(msg);
      setTemplates([]);
      setSelectedTemplate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: PdfTemplate) => {
    setSelectedTemplate(template);
    setBodyHtml(template.bodyHtml);
    setCssStyles(template.cssStyles ?? "");
    setError("");
    setSuccess("");
    setActiveTab("html");
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchApi<PdfTemplate>("/api/templates/pdf", {
        method: "PUT",
        body: JSON.stringify({
          id: selectedTemplate.id,
          bodyHtml,
          cssStyles: cssStyles || null,
        }),
      });
      setSuccess("Šablóna bola úspešne uložená.");
      const updated = res.data;
      setTemplates((prev) => prev.map((t) => (t.id === selectedTemplate.id ? updated : t)));
      setSelectedTemplate(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nepodarilo sa uložiť šablónu";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim()) {
      setError("Kód aj názov novej šablóny sú povinné.");
      return;
    }
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchApi<PdfTemplate>("/api/templates/pdf", {
        method: "POST",
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          bodyHtml: "<p>Nová PDF šablóna. Upravte obsah podľa potreby.</p>",
          cssStyles: null,
        }),
      });
      const created = res.data;
      setTemplates((prev) => [...prev, created]);
      handleSelectTemplate(created);
      setNewCode("");
      setNewName("");
      setShowCreateForm(false);
      setSuccess(`Šablóna '${created.name}' bola vytvorená.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nepodarilo sa vytvoriť šablónu";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const insertVariable = (code: string, targetField: "html" | "css") => {
    if (targetField === "html") {
      setBodyHtml((prev) => prev + code);
    } else {
      setCssStyles((prev) => prev + code);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-500">
        <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Načítavam PDF šablóny...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">PDF šablóny</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Editujte HTML &amp; CSS šablóny pre generovanie PDF dokumentov pre zákazníkov.
          </p>
        </div>
        <div className="flex gap-2">
          {hasWritePermission && (
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm((v) => !v);
                setError("");
              }}
            >
              {showCreateForm ? "Zrušiť" : "+ Nová šablóna"}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasWritePermission || !selectedTemplate}
          >
            {saving ? "Ukladám..." : "Uložiť šablónu"}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Create new form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vytvoriť novú šablónu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Kód šablóny <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="SALES_QUOTE_DEFAULT"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Názov šablóny <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Predajný cenový list"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Vytváram..." : "Vytvoriť"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel: template list + variables */}
        <div className="lg:col-span-1 space-y-4">
          {/* Template list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Zoznam šablón</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {templates.length === 0 ? (
                <p className="px-4 py-3 text-xs text-neutral-400">
                  Žiadne šablóny. Vytvorte prvú.
                </p>
              ) : (
                <div className="flex flex-col">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className={`text-left px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors ${
                        selectedTemplate?.id === t.id
                          ? "bg-primary/5 border-l-2 border-l-primary font-medium text-primary"
                          : "text-neutral-700"
                      }`}
                    >
                      <span className="block text-sm">{t.name}</span>
                      <span className="block text-xs font-mono text-neutral-400 mt-0.5">
                        {t.code}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dynamic variables */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dynamické premenné</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="text-xs text-neutral-500 mb-2">
                Kliknutím pridáte premennú na koniec aktívneho editora (HTML/CSS).
              </p>
              {PDF_VARIABLES.map((v) => (
                <button
                  key={v.code}
                  onClick={() => insertVariable(v.code, activeTab === "css" ? "css" : "html")}
                  className="w-full text-left px-2 py-1.5 text-xs font-mono bg-neutral-100 hover:bg-neutral-200 rounded text-neutral-700 transition-colors"
                >
                  <span className="font-sans font-medium block mb-0.5 text-neutral-600">
                    {v.label}
                  </span>
                  {v.code}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: editors + preview */}
        <div className="lg:col-span-3 space-y-6">
          {selectedTemplate ? (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 border-b border-neutral-200 pb-0">
                {(["html", "css", "preview"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px ${
                      activeTab === tab
                        ? "bg-white border border-b-white border-neutral-200 text-primary"
                        : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {tab === "html" && "HTML šablóna"}
                    {tab === "css" && "CSS štýly"}
                    {tab === "preview" && "🖥 Živý náhľad"}
                  </button>
                ))}
              </div>

              {/* HTML editor */}
              {activeTab === "html" && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      HTML kód – {selectedTemplate.name}
                      <span className="ml-2 text-xs font-mono font-normal text-neutral-400">
                        {selectedTemplate.code}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      HTML telo dokumentu
                    </label>
                    <textarea
                      id="pdf-html-editor"
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      disabled={!hasWritePermission}
                      spellCheck={false}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm h-96 resize-y disabled:bg-neutral-100 leading-relaxed"
                      placeholder="<html><body>Obsah PDF šablóny...</body></html>"
                    />
                    <p className="text-xs text-neutral-400 mt-2">
                      Použite plnohodnotné HTML vrátane inline štýlov alebo odkazov na CSS sekciu. Premenné vo formáte{" "}
                      <code className="bg-neutral-100 px-1 rounded">{"{{nazov}}"}</code> budú nahradené reálnymi hodnotami.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* CSS editor */}
              {activeTab === "css" && (
                <Card>
                  <CardHeader>
                    <CardTitle>CSS štýly – {selectedTemplate.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Globálne CSS pre PDF dokument
                    </label>
                    <textarea
                      id="pdf-css-editor"
                      value={cssStyles}
                      onChange={(e) => setCssStyles(e.target.value)}
                      disabled={!hasWritePermission}
                      spellCheck={false}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm h-96 resize-y disabled:bg-neutral-100 leading-relaxed"
                      placeholder={`body { font-family: 'Helvetica', sans-serif; margin: 0; }\n.header { background: #8b1a1a; color: white; }\n@page { size: A4; margin: 20mm; }`}
                    />
                    <p className="text-xs text-neutral-400 mt-2">
                      Štýly budú injektované do{" "}
                      <code className="bg-neutral-100 px-1 rounded">&lt;style&gt;</code> tagu pri generovaní PDF.
                      Podporované sú CSS vlastnosti kompatibilné s Chromium rendererom.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Live preview */}
              {activeTab === "preview" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Živý náhľad PDF layoutu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-neutral-500 mb-3">
                      Náhľad kombinuje HTML šablónu a CSS štýly. Premenné{" "}
                      <code className="bg-neutral-100 px-1 rounded">{"{{...}}"}</code> sú zobrazené doslovne – v reálnom PDF budú nahradené dátami.
                    </p>
                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <iframe
                        ref={previewIframeRef}
                        id="pdf-preview-frame"
                        title="PDF náhľad"
                        className="w-full h-[680px]"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="p-16 text-center text-neutral-500 bg-white rounded-xl border border-neutral-200 border-dashed">
              <svg
                className="w-12 h-12 mx-auto mb-4 text-neutral-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="font-medium text-neutral-400">Vyberte šablónu zo zoznamu</p>
              <p className="text-sm text-neutral-300 mt-1">
                alebo vytvorte novú kliknutím na „+ Nová šablóna"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
