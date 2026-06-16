"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/apiClient";

export default function GDPRSettingsPage() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchApi<{ value: string }>("/api/settings/gdpr")
      .then(({ data }) => {
        setContent(data?.value || "");
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetchApi("/api/settings/gdpr", {
        method: "PUT",
        body: JSON.stringify({ value: content }),
      });
      alert("Nastavenia uložené");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GDPR Nastavenia</h1>
        <p className="text-gray-500 mt-1">Úprava textu podmienok spracovania osobných údajov</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML Obsah
            </label>
            <textarea
              className="w-full h-96 p-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="<p>Základné podmienky...</p>"
            />
            <p className="text-xs text-gray-500 mt-2">Tento obsah sa zobrazí návštevníkom v modálnom okne konfigurátora.</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSaving ? "Ukladá sa..." : "Uložiť zmeny"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
